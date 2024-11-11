import EventEmitter from "events";
import fs from "fs";
import { glob } from "glob";
import path from "path";
import { pathToFileURL } from "url";
import createClient from "./lib/createClient.js";
import {
  fileChecksum,
  sortMigrationsAsc,
  sortMigrationsDesc,
} from "./lib/utils.js";

const DEFAULT_CONFIG = {
  schemaTable: "schemaversion",
  validateChecksums: true,
};

class Postgrator extends EventEmitter {
  constructor(config) {
    super();
    this.config = Object.assign({}, DEFAULT_CONFIG, config);
    this.migrations = [];
    this.commonClient = createClient(this.config);
  }

  /**
   * Reads all migrations from directory
   *
   * @returns {Promise} array of migration objects
   */
  async getMigrations() {
    const { migrationPattern, newline } = this.config;
    const migrationFiles = await glob(migrationPattern);
    let migrations = await Promise.all(
      migrationFiles
        .filter(
          (file) =>
            [".sql", ".js", ".mjs", ".cjs"].indexOf(path.extname(file)) >= 0
        )
        .sort()
        .map(async (filename) => {
          const basename = path.basename(filename);
          const ext = path.extname(basename);

          const basenameNoExt = path.basename(filename, ext);
          let [version, action, name = ""] = basenameNoExt.split(".");
          version = Number(version);

          if (ext === ".sql") {
            return {
              version,
              action,
              filename,
              name,
              md5: fileChecksum(filename, newline),
              getSql: () => fs.readFileSync(filename, "utf8"),
            };
          }

          if (ext === ".js" || ext === ".cjs" || ext === ".mjs") {
            const jsModule = await import(pathToFileURL(filename));

            return {
              version,
              action,
              filename,
              name,
              // JS files are dynamic, so resulting content could change
              // Prettier and JS trends mean that formatting could also change over time
              // Considering these things, md5 hashing for JS will be skipped.
              md5: undefined,
              getSql: () => jsModule.generateSql(),
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
   * Executes sql query using the commonClient runQuery function
   *
   * @returns {Promise} result of query
   * @param {String} query sql query to execute
   */
  async runQuery(query) {
    return this.commonClient.runQuery(query);
  }

  /**
   * Executes db migration script consisting of multiple SQL statements
   * using the commonClient runSqlScript function
   *
   * @returns {Promise} void
   * @param {String} sqlScript sql queries to execute
   */
  async runSqlScript(sqlScript) {
    return this.commonClient.runSqlScript(sqlScript);
  }

  /**
   * Gets the database version of the schema from the database.
   * Otherwise 0 if no version has been run
   *
   * @returns {Promise} database schema version
   */
  async getDatabaseVersion() {
    const versionSql = this.commonClient.getDatabaseVersionSql();

    const initialized = await this.commonClient.hasVersionTable();
    if (!initialized) {
      return 0;
    }

    const result = await this.commonClient.runQuery(versionSql);
    const version = result.rows.length > 0 ? result.rows[0].version : 0;
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
      // IF md5 exists in DB and on migration, it means we should validate the md5
      // (JS migrations no longer generate an md5 because they can be so dynamic.
      // Deleting an md5 from database could be useful for skipping a problematic check)
      if (md5 && migration.md5 && md5 !== migration.md5) {
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
        await commonClient.runSqlScript(sql);
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
   * A target must be specified, otherwise the schema will be moved to the maximum available version.
   *
   * @returns {Promise}
   * @param {String} target - version to migrate as string or number (handled as numbers internally)
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
      return migrations;
    } catch (error) {
      // Decorate error with empty appliedMigrations if not yet exist
      // Rethrow error to module user
      if (!error.appliedMigrations) {
        error.appliedMigrations = [];
      }
      throw error;
    }
  }
}

export default Postgrator;
