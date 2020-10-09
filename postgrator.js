const fs = require('fs')
const path = require('path')
const glob = require('glob')
const EventEmitter = require('events')

const createCommonClient = require('./lib/createCommonClient.js')
const {
  fileChecksum,
  checksum,
  sortMigrationsAsc,
  sortMigrationsDesc,
} = require('./lib/utils.js')

const DEFAULT_CONFIG = {
  schemaTable: 'schemaversion',
  validateChecksums: true,
}

class Postgrator extends EventEmitter {
  constructor(config) {
    super()
    this.config = Object.assign({}, DEFAULT_CONFIG, config)
    this.migrations = []
    this.commonClient = createCommonClient(this.config)
  }

  /**
   * Reads all migrations from directory
   *
   * @returns {Promise} array of migration objects
   */
  getMigrations() {
    const { migrationDirectory, migrationPattern, newline } = this.config
    return new Promise((resolve, reject) => {
      const loader = (err, files) => {
        if (err) {
          return reject(err)
        }
        resolve(files)
      }
      if (migrationPattern) {
        glob(migrationPattern, loader)
      } else if (migrationDirectory) {
        fs.readdir(migrationDirectory, loader)
      } else {
        resolve([])
      }
    })
      .then((migrationFiles) => {
        return Promise.all(migrationFiles
          .filter((file) => ['.sql', '.js'].indexOf(path.extname(file)) >= 0)
          .map(async (file) => {
            const basename = path.basename(file)
            const ext = path.extname(basename)

            const basenameNoExt = path.basename(file, ext)
            let [version, action, name = ''] = basenameNoExt.split('.')
            version = Number(version)

            const filename = migrationPattern
              ? file
              : path.join(migrationDirectory, file)

            // TODO normalize filename on returned migration object
            // Today it is full path if glob is used, otherwise basename with extension
            // This is not persisted in the database, but this field might be a part of someone's workflow
            // Making this change will be a breaking fix

            if (ext === '.sql') {
              return {
                version,
                action,
                filename: file,
                name,
                md5: fileChecksum(filename, newline),
                getSql: () => fs.readFileSync(filename, 'utf8'),
              }
            }

            if (ext === '.js') {
              const jsModule = require(filename)
              const sql = await jsModule.generateSql()

              return {
                version,
                action,
                filename: file,
                name,
                md5: checksum(sql, newline),
                getSql: () => sql,
              }
            }
          })
      )})
      .then((migrations) =>
        migrations.filter((migration) => !isNaN(migration.version))
      )
      .then((migrations) => {
        const getMigrationKey = (migration) =>
          `${migration.version}:${migration.action}`
        const migrationKeys = new Set()
        migrations.forEach((migration) => {
          const newKey = getMigrationKey(migration)
          if (migrationKeys.has(newKey)) {
            throw new Error(
              `Two migrations found with version ${migration.version} and action ${migration.action}`
            )
          }
          migrationKeys.add(newKey)
        })
        return migrations
      })
      .then((migrations) => {
        this.migrations = migrations
        return migrations
      })
  }

  /**
   * Executes sql query using the common client and ends connection afterwards
   *
   * @returns {Promise} result of query
   * @param {String} query sql query to execute
   */
  runQuery(query) {
    const { commonClient } = this
    return commonClient.runQuery(query).then((results) => {
      return commonClient.endConnection().then(() => results)
    })
  }

  /**
   * Gets the database version of the schema from the database.
   * Otherwise 0 if no version has been run
   *
   * @returns {Promise} database schema version
   */
  getDatabaseVersion() {
    const versionSql = this.commonClient.getDatabaseVersionSql()
    return this.commonClient.runQuery(versionSql).then((result) => {
      const version = result.rows.length > 0 ? result.rows[0].version : 0
      return this.commonClient.endConnection().then(() => parseInt(version))
    })
  }

  /**
   * Returns an object with max version of migration available
   *
   * @returns {Promise}
   */
  getMaxVersion() {
    const { migrations } = this
    return Promise.resolve()
      .then(() => {
        if (migrations.length) {
          return migrations
        } else {
          return this.getMigrations()
        }
      })
      .then((migrations) => {
        const versions = migrations.map((migration) => migration.version)
        return Math.max.apply(null, versions)
      })
  }

  /**
   * Validate md5 checksums for applied migrations
   *
   * @returns {Promise}
   * @param {Number} databaseVersion
   */
  validateMigrations(databaseVersion) {
    return this.getMigrations().then((migrations) => {
      const validateMigrations = migrations.filter(
        (migration) =>
          migration.action === 'do' &&
          migration.version > 0 &&
          migration.version <= databaseVersion
      )

      let sequence = Promise.resolve()
      validateMigrations.forEach((migration) => {
        sequence = sequence
          .then(() => this.emit('validation-started', migration))
          .then(() => {
            const sql = this.commonClient.getMd5Sql(migration)
            return this.commonClient.runQuery(sql)
          })
          .then((results) => {
            const md5 = results.rows && results.rows[0] && results.rows[0].md5
            if (md5 !== migration.md5) {
              const msg = `MD5 checksum failed for migration [${migration.version}]`
              throw new Error(msg)
            }
          })
          .then(() => this.emit('validation-finished', migration))
      })
      return sequence.then(() => validateMigrations)
    })
  }

  /**
   * Runs the migrations in the order to reach target version
   *
   * @returns {Promise} - Array of migration objects to appled to database
   * @param {Array} migrations - Array of migration objects to apply to database
   */
  runMigrations(migrations = []) {
    const { commonClient } = this
    let sequence = Promise.resolve()
    const appliedMigrations = []
    migrations.forEach((migration) => {
      sequence = sequence
        .then(() => this.emit('migration-started', migration))
        .then(() => migration.getSql())
        .then((sql) => commonClient.runQuery(sql))
        .then(() =>
          commonClient.runQuery(commonClient.persistActionSql(migration))
        )
        .then(() => appliedMigrations.push(migration))
        .then(() => this.emit('migration-finished', migration))
    })
    return sequence
      .then(() => appliedMigrations)
      .catch((error) => {
        error.appliedMigrations = appliedMigrations
        throw error
      })
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
    const { migrations } = this
    if (targetVersion >= databaseVersion) {
      return migrations
        .filter(
          (migration) =>
            migration.action === 'do' &&
            migration.version > databaseVersion &&
            migration.version <= targetVersion
        )
        .sort(sortMigrationsAsc)
    }
    if (targetVersion < databaseVersion) {
      return migrations
        .filter(
          (migration) =>
            migration.action === 'undo' &&
            migration.version <= databaseVersion &&
            migration.version > targetVersion
        )
        .sort(sortMigrationsDesc)
    }
    return []
  }

  /**
   * Main method to move a schema to a particular version.
   * A target must be specified, otherwise nothing is run.
   *
   * @returns {Promise}
   * @param {String} target - version to migrate as string or number (handled as  numbers internally)
   */
  migrate(target = '') {
    const { commonClient, config } = this
    const data = {}
    return commonClient
      .ensureTable()
      .then(() => this.getMigrations())
      .then(() => {
        const cleaned = target.toLowerCase().trim()
        if (cleaned === 'max' || cleaned === '') {
          return this.getMaxVersion()
        }
        return Number(target)
      })
      .then((targetVersion) => {
        data.targetVersion = targetVersion
        if (target === undefined) {
          throw new Error('targetVersion undefined')
        }
        return this.getDatabaseVersion()
      })
      .then((databaseVersion) => {
        data.databaseVersion = databaseVersion
        if (config.validateChecksums && data.targetVersion >= databaseVersion) {
          return this.validateMigrations(databaseVersion)
        }
      })
      .then(() =>
        this.getRunnableMigrations(data.databaseVersion, data.targetVersion)
      )
      .then((runnableMigrations) => this.runMigrations(runnableMigrations))
      .then((migrations) => commonClient.endConnection().then(() => migrations))
      .catch((error) => {
        // Decorate error with empty appliedMigrations if not yet exist
        // Rethrow error to module user
        if (!error.appliedMigrations) {
          error.appliedMigrations = []
        }

        // Attempt to close connection then throw original error
        return commonClient
          .endConnection()
          .catch(() => {})
          .then(() => {
            throw error
          })
      })
  }
}

module.exports = Postgrator
