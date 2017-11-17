const fs = require('fs')
const path = require('path')
const EventEmitter = require('events')

const commonClient = require('./lib/commonClient.js')
const {
  fileChecksum,
  checksum,
  sortMigrationsAsc,
  sortMigrationsDesc
} = require('./lib/utils.js')

const DEFAULT_CONFIG = {
  schemaTable: 'schemaversion',
  validateChecksums: true
}

class Postgrator extends EventEmitter {
  constructor(config) {
    super()
    this.config = Object.assign({}, DEFAULT_CONFIG, config)
    this.migrations = []
    this.commonClient = commonClient(this.config)
  }

  /**
   * Reads all migrations from directory
   * Returns promise of array of objects in format:
   * {version: n, action: 'do', filename: '0001.up.sql'}
   *
   * @returns {Promise} array of migration objects
   */
  getMigrations() {
    const { migrationDirectory, newline } = this.config
    this.migrations = []
    return new Promise((resolve, reject) => {
      fs.readdir(migrationDirectory, (err, files) => {
        if (err) {
          return reject(err)
        }
        resolve(files)
      })
    }).then(migrationFiles => {
      migrationFiles.forEach(file => {
        const m = file.split('.')
        const name = m.length >= 3 ? m.slice(2, m.length - 1).join('.') : file
        const filename = path.join(migrationDirectory, file)
        if (m[m.length - 1] === 'sql') {
          this.migrations.push({
            version: Number(m[0]),
            action: m[1],
            filename: file,
            name: name,
            md5: fileChecksum(filename, newline),
            getSql: () => fs.readFileSync(filename, 'utf8')
          })
        } else if (m[m.length - 1] === 'js') {
          const jsModule = require(filename)
          const sql = jsModule.generateSql()
          this.migrations.push({
            version: Number(m[0]),
            action: m[1],
            filename: file,
            name: name,
            md5: checksum(sql, newline),
            getSql: () => sql
          })
        }
      })
      this.migrations = this.migrations.filter(
        migration => !isNaN(migration.version)
      )
      return this.migrations
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
    return commonClient.runQuery(query).then(results => {
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
    const { runQuery, endConnection, queries } = this.commonClient
    return runQuery(queries.databaseVersionSql).then(result => {
      const version = result.rows.length > 0 ? result.rows[0].version : 0
      return endConnection().then(() => version)
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
      .then(migrations => {
        const versions = migrations.map(migration => migration.version)
        return Math.max.apply(null, versions)
      })
  }

  /**
   * Validate md5 checksums for applied migrations
   *
   * @returns {Promise}
   * @param {Number} databaseVersion
   * @param {Number} targetVersion
   */
  validateMigrations(databaseVersion, targetVersion) {
    const { config } = this
    return this.getMigrations().then(migrations => {
      if (targetVersion >= databaseVersion) {
        const validateMigrations = migrations
          .filter(
            migration =>
              migration.action === 'do' &&
              migration.version > 0 &&
              migration.version <= databaseVersion
          )
          .map(migration => {
            migration.md5Sql = `
              SELECT md5 
              FROM ${config.schemaTable} 
              WHERE version = ${migration.version};`
            return migration
          })

        let sequence = Promise.resolve()
        validateMigrations.forEach(migration => {
          sequence = sequence
            .then(() => this.emit('validation-started', migration))
            .then(() => this.commonClient.runQuery(migration.md5Sql))
            .then(result => {
              const row = result.rows[0]
              if (row && row.md5 && row.md5 !== migration.md5) {
                const msg = `For migration [${
                  migration.version
                }], expected MD5 checksum [${migration.md5}] but got [${
                  row.md5
                }]`
                throw new Error(msg)
              }
            })
            .then(() => this.emit('validation-finished', migration))
        })
        return sequence.then(() => validateMigrations)
      }
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
    migrations.forEach(migration => {
      sequence = sequence
        .then(() => this.emit('migration-started', migration))
        .then(() => migration.getSql())
        .then(sql => commonClient.runQuery(sql))
        .then(() =>
          commonClient.runQuery(commonClient.persistActionSql(migration))
        )
        .then(() => appliedMigrations.push(migration))
        .then(() => this.emit('migration-finished', migration))
    })
    return sequence.then(() => appliedMigrations)
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
          migration =>
            migration.action === 'do' &&
            migration.version > databaseVersion &&
            migration.version <= targetVersion
        )
        .sort(sortMigrationsAsc)
    }
    if (targetVersion < databaseVersion) {
      return migrations
        .filter(
          migration =>
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
    const { commonClient } = this
    const data = {}
    return commonClient
      .ensureTable()
      .then(() => this.getMigrations())
      .then(() => {
        const cleaned = target.toLowerCase().trim()
        if (cleaned === 'max' || cleaned === '') {
          return this.getMaxVersion()
        } else {
          return Number(target)
        }
      })
      .then(targetVersion => {
        if (targetVersion === undefined) {
          throw new Error('targetVersion undefined')
        }
        data.targetVersion = targetVersion
        return this.getDatabaseVersion()
      })
      .then(databaseVersion => (data.databaseVersion = databaseVersion))
      .then(() => {
        if (this.config.validateChecksums) {
          return this.validateMigrations(
            data.databaseVersion,
            data.targetVersion
          )
        }
      })
      .then(() =>
        this.getRunnableMigrations(data.databaseVersion, data.targetVersion)
      )
      .then(runnableMigrations => this.runMigrations(runnableMigrations))
      .then(migrations => commonClient.endConnection().then(() => migrations))
  }
}

module.exports = Postgrator
