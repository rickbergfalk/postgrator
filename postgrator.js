const fs = require("fs");
const path = require("path");
const glob = require("glob");
const EventEmitter = require("events");
const deprecate = require("depd")("postgrator");

const createCommonClient = require("./lib/createCommonClient.js");
const {
  fileChecksum,
  checksum,
  sortMigrationsAsc,
  sortMigrationsDesc,
} = require("./lib/utils.js");

const DEFAULT_CONFIG = {
  schemaTable: "schemaversion",
  validateChecksums: true,
};

function loadMigrationDirOrPath(migrationDirectory, migrationPattern) {
  return new Promise((resolve, reject) => {
    const loader = (err, files) => {
      if (err) {
        return reject(err);
      }
      resolve(files);
    };
    if (migrationPattern) {
      glob(migrationPattern, loader);
    } else if (migrationDirectory) {
      fs.readdir(migrationDirectory, loader);
    } else {
      resolve([]);
    }
  });
}

class Postgrator extends EventEmitter {
  constructor(config) {
    super();
    this.config = Object.assign({}, DEFAULT_CONFIG, config);
    this.migrations = [];
    this.commonClient = createCommonClient(this.config);

    // Instantiation with database credentials is deprecated
    // Next major version of postgrator will require user manage the connection
    // and provide the `execQuery` function
    if (this.config.port) {
      deprecate(`Config option "port". Implement execQuery function instead.`);
    }
    if (this.config.host) {
      deprecate(`Config option "host". Implement execQuery function instead.`);
    }
    if (this.config.username) {
      deprecate(
        `Config option "username". Implement execQuery function instead.`
      );
    }
    if (this.config.password) {
      deprecate(
        `Config option "password". Implement execQuery function instead.`
      );
    }
    if (this.config.ssl) {
      deprecate(`Config option "ssl". Implement execQuery function instead.`);
    }
    if (this.config.options) {
      deprecate(
        `Config option "options". Implement execQuery function instead.`
      );
    }
    if (this.config.migrationDirectory) {
      deprecate(
        `Config option "migrationDirectory". use "migrationPattern" instead using glob match. e.g. path.join(__dirname, '/migrations/*')`
      );
    }
  }

  /**
   * Reads all migrations from directory
   *
   * @returns {Promise} array of migration objects
   */
  async getMigrations() {
    const { migrationDirectory, migrationPattern, newline } = this.config;
    const migrationFiles = await loadMigrationDirOrPath(
      migrationDirectory,
      migrationPattern
    );
    let migrations = await Promise.all(
      migrationFiles
        .filter((file) => [".sql", ".js"].indexOf(path.extname(file)) >= 0)
        .map(async (file) => {
          const basename = path.basename(file);
          const ext = path.extname(basename);

          const basenameNoExt = path.basename(file, ext);
          let [version, action, name = ""] = basenameNoExt.split(".");
          version = Number(version);

          const filename = migrationPattern
            ? file
            : path.join(migrationDirectory, file);

          // TODO normalize filename on returned migration object
          // Today it is full path if glob is used, otherwise basename with extension
          // This is not persisted in the database, but this field might be a part of someone's workflow
          // Making this change will be a breaking fix

          if (ext === ".sql") {
            return {
              version,
              action,
              filename: file,
              name,
              md5: fileChecksum(filename, newline),
              getSql: () => fs.readFileSync(filename, "utf8"),
            };
          }

          if (ext === ".js") {
            const jsModule = require(filename);
            const sql = await jsModule.generateSql();

            return {
              version,
              action,
              filename: file,
              name,
              md5: checksum(sql, newline),
              getSql: () => sql,
            };
          }
        })
    );

    migrations = migrations.filter((migration) => !isNaN(migration.version));

    const getMigrationKey = (migration) =>
      `${migration.version}:${migration.action}`;

    const migrationKeys = new Set();

    migrations.forEach((migration) => {
      const newKey = getMigrationKey(migration);
      if (migrationKeys.has(newKey)) {
        throw new Error(
          `Two migrations found with version ${migration.version} and action ${migration.action}`
        );
      }
      migrationKeys.add(newKey);
    });

    this.migrations = migrations;
    return migrations;
  }

  /**
   * Executes sql query using the common client and ends connection afterwards
   *
   * @returns {Promise} result of query
   * @param {String} query sql query to execute
   */
  async runQuery(query) {
    deprecate("runQuery. Use your db driver directly instead.");
    const { commonClient } = this;
    const results = await commonClient.runQuery(query);
    await commonClient.endConnection();
    return results;
  }

  /**
   * Gets the database version of the schema from the database.
   * Otherwise 0 if no version has been run
   *
   * @returns {Promise} database schema version
   */
  async getDatabaseVersion() {
    const versionSql = this.commonClient.getDatabaseVersionSql();
    const result = await this.commonClient.runQuery(versionSql);
    const version = result.rows.length > 0 ? result.rows[0].version : 0;
    await this.commonClient.endConnection();
    return parseInt(version);
  }

  /**
   * Returns an object with max version of migration available
   *
   * @returns {Promise}
   */
  async getMaxVersion() {
    let { migrations } = this;
    if (!this.migrations.length) {
      migrations = await this.getMigrations();
    }
    const versions = migrations.map((migration) => migration.version);
    return Math.max.apply(null, versions);
  }

  /**
   * Validate md5 checksums for applied migrations
   *
   * @returns {Promise}
   * @param {Number} databaseVersion
   */
  async validateMigrations(databaseVersion) {
    const migrations = await this.getMigrations();

    const validateMigrations = migrations.filter(
      (migration) =>
        migration.action === "do" &&
        migration.version > 0 &&
        migration.version <= databaseVersion
    );

    for (const migration of validateMigrations) {
      this.emit("validation-started", migration);
      const sql = this.commonClient.getMd5Sql(migration);
      const results = await this.commonClient.runQuery(sql);
      const md5 = results.rows && results.rows[0] && results.rows[0].md5;
      if (md5 !== migration.md5) {
        const msg = `MD5 checksum failed for migration [${migration.version}]`;
        throw new Error(msg);
      }
      this.emit("validation-finished", migration);
    }

    return validateMigrations;
  }

  /**
   * Runs the migrations in the order to reach target version
   *
   * @returns {Promise} - Array of migration objects to appled to database
   * @param {Array} migrations - Array of migration objects to apply to database
   */
  async runMigrations(migrations = []) {
    const { commonClient } = this;
    const appliedMigrations = [];
    try {
      for (const migration of migrations) {
        this.emit("migration-started", migration);
        const sql = await migration.getSql();
        await commonClient.runQuery(sql);
        await commonClient.runQuery(commonClient.persistActionSql(migration));
        appliedMigrations.push(migration);
        this.emit("migration-finished", migration);
      }
    } catch (error) {
      error.appliedMigrations = appliedMigrations;
      throw error;
    }
    return appliedMigrations;
  }

  /**
   * returns an array of relevant migrations based on the target and database version passed.
   * returned array is sorted in the order it needs to be run
   *
   * @returns {Array} Sorted array of relevant migration objects
   * @param {Number} databaseVersion
   * @param {Number} targetVersion
   */
  getRunnableMigrations(databaseVersion, targetVersion) {
    const { migrations } = this;
    if (targetVersion >= databaseVersion) {
      return migrations
        .filter(
          (migration) =>
            migration.action === "do" &&
            migration.version > databaseVersion &&
            migration.version <= targetVersion
        )
        .sort(sortMigrationsAsc);
    }
    if (targetVersion < databaseVersion) {
      return migrations
        .filter(
          (migration) =>
            migration.action === "undo" &&
            migration.version <= databaseVersion &&
            migration.version > targetVersion
        )
        .sort(sortMigrationsDesc);
    }
    return [];
  }

  /**
   * Main method to move a schema to a particular version.
   * A target must be specified, otherwise nothing is run.
   *
   * @returns {Promise}
   * @param {String} target - version to migrate as string or number (handled as  numbers internally)
   */
  async migrate(target = "") {
    const { commonClient, config } = this;
    const data = {};
    try {
      await commonClient.ensureTable();
      await this.getMigrations();
      let targetVersion;
      const cleaned = target.toLowerCase().trim();
      if (cleaned === "max" || cleaned === "") {
        targetVersion = await this.getMaxVersion();
      } else {
        targetVersion = Number(target);
      }
      data.targetVersion = targetVersion;
      if (target === undefined) {
        throw new Error("targetVersion undefined");
      }
      const databaseVersion = await this.getDatabaseVersion();
      data.databaseVersion = databaseVersion;
      if (config.validateChecksums && data.targetVersion >= databaseVersion) {
        await this.validateMigrations(databaseVersion);
      }
      const runnableMigrations = await this.getRunnableMigrations(
        data.databaseVersion,
        data.targetVersion
      );
      const migrations = await this.runMigrations(runnableMigrations);
      await commonClient.endConnection();
      return migrations;
    } catch (error) {
      // Decorate error with empty appliedMigrations if not yet exist
      // Rethrow error to module user
      if (!error.appliedMigrations) {
        error.appliedMigrations = [];
      }
      // Attempt to close connection then throw original error
      try {
        await commonClient.endConnection();
      } catch (error) {
        // no op
      }
      throw error;
    }
  }
}

module.exports = Postgrator;
