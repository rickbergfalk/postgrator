const fs = require('fs')
const commonClient = require('./lib/commonClient.js')
const {
  fileChecksum,
  checksum,
  sortMigrationsAsc,
  sortMigrationsDesc
} = require('./lib/utils.js')

class Postgrator {
  constructor(config) {
    config.schemaTable = config.schemaTable || 'schemaversion'
    this.config = config
    this.migrations = []
    this.commonClient = commonClient(config)
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
        const filename = migrationDirectory + '/' + file
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
   * Gets the current version of the schema from the database.
   * Otherwise 0 if no version has been run
   *
   * @returns {Promise} current schema version
   */
  getCurrentVersion() {
    const currentVersionSql = this.commonClient.queries.getCurrentVersion
    const { runQuery, endConnection } = this.commonClient
    return runQuery(currentVersionSql).then(result => {
      const version = result.rows.length > 0 ? result.rows[0].version : 0
      return endConnection().then(() => version)
    })
  }

  /**
   * Returns an object with current applied version of the schema from
   * the database and max version of migration available
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
   * @param {Number} currentVersion
   * @param {Number} targetVersion
   */
  validateMigrations(currentVersion, targetVersion) {
    const { config } = this
    return this.getMigrations().then(migrations => {
      if (targetVersion >= currentVersion) {
        const validateMigrations = migrations
          .filter(
            migration =>
              migration.action === 'do' &&
              migration.version > 0 &&
              migration.version <= currentVersion
          )
          .map(migration => {
            migration.md5Sql = `
              SELECT md5 FROM ${config.schemaTable} 
              WHERE version = ${migration.version};`
            return migration
          })

        let sequence = Promise.resolve()
        validateMigrations.forEach(migration => {
          sequence = sequence
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
    let sequence = Promise.resolve()
    const appliedMigrations = []
    migrations.forEach(migration => {
      sequence = sequence
        .then(() => migration.getSql())
        .then(sql => this.commonClient.runQuery(sql))
        .then(() => this.commonClient.runQuery(migration.schemaVersionSQL))
        .then(() => appliedMigrations.push(migration))
    })
    return sequence.then(() => appliedMigrations)
  }

  /**
   * returns an array of relevant migrations based on the target and current version passed.
   * returned array is sorted in the order it needs to be run
   *
   * @returns {Array} Sorted array of relevant migration objects
   * @param {Number} currentVersion
   * @param {Number} targetVersion
   */
  getRunnableMigrations(currentVersion, targetVersion) {
    const { config, migrations } = this
    if (targetVersion >= currentVersion) {
      return migrations
        .filter(
          migration =>
            migration.action === 'do' &&
            migration.version > currentVersion &&
            migration.version <= targetVersion
        )
        .map(migration => {
          migration.schemaVersionSQL = `
            INSERT INTO ${config.schemaTable} (version, name, md5) 
            VALUES (
              ${migration.version}, 
              '${migration.name}', 
              '${migration.md5}'
            );`
          return migration
        })
        .sort(sortMigrationsAsc)
    }
    if (targetVersion < currentVersion) {
      return migrations
        .filter(
          migration =>
            migration.action === 'undo' &&
            migration.version <= currentVersion &&
            migration.version > targetVersion
        )
        .map(migration => {
          migration.schemaVersionSQL = `
            DELETE FROM ${config.schemaTable} 
            WHERE version = ${migration.version};`
          return migration
        })
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
    const data = {}
    return this.commonClient
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
        return this.getCurrentVersion()
      })
      .then(currentVersion => (data.currentVersion = currentVersion))
      .then(() =>
        this.validateMigrations(data.currentVersion, data.targetVersion)
      )
      .then(() =>
        this.getRunnableMigrations(data.currentVersion, data.targetVersion)
      )
      .then(runnableMigrations => this.runMigrations(runnableMigrations))
      .then(migrations =>
        this.commonClient.endConnection().then(() => migrations)
      )
  }
}

module.exports = Postgrator
