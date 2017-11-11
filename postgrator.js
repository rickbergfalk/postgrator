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
   * Connects the database driver if it is not currently connected.
   * Executes an arbitrary sql query using the common client
   *
   * @returns {Promise} result of query
   * @param {String} query sql query to execute
   */
  runQuery(query) {
    const { commonClient } = this
    if (commonClient.connected) {
      return commonClient.runQuery(query)
    } else {
      return commonClient.createConnection().then(() => {
        commonClient.connected = true
        return commonClient.runQuery(query)
      })
    }
  }

  /**
   * Ends the commonClient's connection to database
   *
   * @returns {Promise}
   */
  endConnection() {
    const { commonClient } = this
    if (commonClient.connected) {
      return commonClient.endConnection().then(() => {
        commonClient.connected = false
      })
    }
    return Promise.resolve()
  }

  /**
   * Gets the current version of the schema from the database.
   * Otherwise 0 if no version has been run
   *
   * @returns {Promise} current schema version
   */
  getCurrentVersion() {
    const currentVersionSql = this.commonClient.queries.getCurrentVersion
    return this.runQuery(currentVersionSql).then(result => {
      if (result.rows.length > 0) {
        return result.rows[0].version
      } else {
        return 0
      }
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
    const validateMigrations = []
    return this.getMigrations().then(migrations => {
      if (targetVersion >= currentVersion) {
        migrations.forEach(migration => {
          if (
            migration.action === 'do' &&
            migration.version > 0 &&
            migration.version <= currentVersion &&
            config.driver === 'pg'
          ) {
            migration.md5Sql = `SELECT md5 FROM ${
              config.schemaTable
            } WHERE version = ${migration.version};`
            validateMigrations.push(migration)
          }
        })
      }

      let seq = Promise.resolve()
      const validatedMigrations = []
      validateMigrations.forEach(migration => {
        seq = seq.then(() => this.runQuery(migration.md5Sql)).then(result => {
          const row = result.rows[0]
          if (row && row.md5 && row.md5 !== migration.md5) {
            const msg = `For migration [${
              migration.version
            }], expected MD5 checksum [${migration.md5}] but got [${row.md5}]`
            throw new Error(msg)
          }
        })
      })
      return seq.then(() => validatedMigrations)
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
        .then(sql => this.runQuery(sql))
        .then(() => this.runQuery(migration.schemaVersionSQL))
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
          migration.schemaVersionSQL =
            config.driver === 'pg'
              ? `INSERT INTO ${
                  config.schemaTable
                } (version, name, md5) VALUES (${migration.version}, '${
                  migration.name
                }', '${migration.md5}');`
              : `INSERT INTO ${config.schemaTable} (version) VALUES (${
                  migration.version
                });`
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
          migration.schemaVersionSQL = `DELETE FROM ${
            config.schemaTable
          } WHERE version = ${migration.version};`
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
    return this.prep()
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
  }

  /**
   * Creates the table required for Postgrator to keep track of which migrations have been run.
   *
   * @returns {Promise}
   */
  prep() {
    const { commonClient, config } = this
    return this.runQuery(commonClient.queries.checkTable).then(result => {
      if (result.rows && result.rows.length > 0) {
        if (config.driver === 'pg') {
          // config.schemaTable exists, does it have the md5 column? (PostgreSQL only)
          const sql = `
            SELECT column_name, data_type, character_maximum_length 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE table_name = '${config.schemaTable}' 
            AND column_name = 'md5';
          `
          return this.runQuery(sql).then(result => {
            if (!result.rows || result.rows.length === 0) {
              // md5 column doesn't exist, add it
              const sql = `
                ALTER TABLE ${config.schemaTable} 
                ADD COLUMN md5 text DEFAULT '';
              `
              return this.runQuery(sql)
            }
          })
        }
      } else {
        return this.runQuery(commonClient.queries.makeTable)
      }
    })
  }
}

module.exports = Postgrator
