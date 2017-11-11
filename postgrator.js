const fs = require('fs')
const commonClient = require('./lib/commonClient.js')
const {
  fileChecksum,
  checksum,
  sortMigrationsAsc,
  sortMigrationsDesc
} = require('./lib/utils.js')

module.exports = Postgrator

function Postgrator(config) {
  config.schemaTable = config.schemaTable || 'schemaversion'
  this.config = config
  this.commonClient = commonClient(config)
}

/**
 * Reads all migrations from directory
 * Returns promise of array of objects in format:
 * {version: n, action: 'do', filename: '0001.up.sql'}
 *
 * @returns {Promise} array of migration objects
 */
Postgrator.prototype.getMigrations = function getMigrations() {
  const { migrationDirectory, newline } = this.config
  const migrations = []

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
        migrations.push({
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
        migrations.push({
          version: Number(m[0]),
          action: m[1],
          filename: file,
          name: name,
          md5: checksum(sql, newline),
          getSql: () => sql
        })
      }
    })
    this.migrations = migrations.filter(migration => !isNaN(migration.version))
    return this.migrations
  })
}

/**
 * Exposed for testing, but otherwise internal
 * Connects the database driver if it is not currently connected.
 * Executes an arbitrary sql query using the common client
 *
 * @returns {Promise} result of query
 * @param {*} query sql query to execute
 */
Postgrator.prototype.runQuery = function runQuery(query) {
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
Postgrator.prototype.endConnection = function endConnection() {
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
Postgrator.prototype.getCurrentVersion = function getCurrentVersion() {
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
Postgrator.prototype.getMaxVersion = function getMaxVersion() {
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
 * Runs the migrations in the order to reach target version
 *
 * @returns {Promise} - Array of migration objects to appled to database
 * @param {Array} migrations - Array of migration objects to apply to database
 */
Postgrator.prototype.runMigrations = function runMigrations(migrations = []) {
  let seq = Promise.resolve()
  migrations.forEach(migration => {
    seq = seq.then(() => {
      const sql = migration.getSql()
      if (migration.md5Sql) {
        return this.runQuery(migration.md5Sql).then(result => {
          const row = result.rows[0]
          if (row && row.md5 && row.md5 !== migration.md5) {
            const msg = `For migration [${
              migration.version
            }], expected MD5 checksum [${migration.md5}] but got [${row.md5}]`
            throw new Error(msg)
          }
        })
      } else {
        return this.runQuery(sql).then(() =>
          this.runQuery(migration.schemaVersionSQL)
        )
      }
    })
  })
  return seq.then(() => migrations)
}

/**
 * returns an array of relevant migrations based on the target and current version passed.
 * returned array is sorted in the order it needs to be run
 *
 * @returns {Array} Sorted array of relevant migration objects
 * @param {*} currentVersion
 * @param {*} targetVersion
 */
Postgrator.prototype.getRelevantMigrations = function getRelevantMigrations(
  currentVersion,
  targetVersion
) {
  let relevantMigrations = []
  const { config, migrations } = this
  if (targetVersion >= currentVersion) {
    // get all up migrations > currentVersion and <= targetVersion
    migrations.forEach(migration => {
      if (
        migration.action === 'do' &&
        migration.version > 0 &&
        migration.version <= currentVersion &&
        (config.driver === 'pg' || config.driver === 'pg.js')
      ) {
        migration.md5Sql = `SELECT md5 FROM ${
          config.schemaTable
        } WHERE version = ${migration.version};`
        relevantMigrations.push(migration)
      }
      if (
        migration.action === 'do' &&
        migration.version > currentVersion &&
        migration.version <= targetVersion
      ) {
        migration.schemaVersionSQL =
          config.driver === 'pg'
            ? `INSERT INTO ${config.schemaTable} (version, name, md5) VALUES (${
                migration.version
              }, '${migration.name}', '${migration.md5}');`
            : `INSERT INTO ${config.schemaTable} (version) VALUES (${
                migration.version
              });`
        relevantMigrations.push(migration)
      }
    })
    relevantMigrations = relevantMigrations.sort(sortMigrationsAsc)
  } else if (targetVersion < currentVersion) {
    migrations.forEach(migration => {
      if (
        migration.action === 'undo' &&
        migration.version <= currentVersion &&
        migration.version > targetVersion
      ) {
        migration.schemaVersionSQL = `DELETE FROM ${
          config.schemaTable
        } WHERE version = ${migration.version};`
        relevantMigrations.push(migration)
      }
    })
    relevantMigrations = relevantMigrations.sort(sortMigrationsDesc)
  }
  return relevantMigrations
}

/**
 * Main method to move a schema to a particular version.
 * A target must be specified, otherwise nothing is run.
 *
 * @returns {Promise}
 * @param {*} target - version to migrate as string or number (handled as  numbers internally)
 */
Postgrator.prototype.migrate = function(target = '') {
  return this.prep()
    .then(() => this.getMigrations())
    .then(() => {
      if (target.toLowerCase() === 'max') {
        return this.getMaxVersion()
      } else {
        return Number(target)
      }
    })
    .then(targetVersion => {
      if (targetVersion === undefined) {
        throw new Error('No target version supplied')
      }
      return this.getCurrentVersion()
        .then(currentVersion => {
          return this.getRelevantMigrations(currentVersion, targetVersion)
        })
        .then(relevantMigrations => {
          if (relevantMigrations.length > 0) {
            return this.runMigrations(relevantMigrations)
          }
        })
    })
}

/**
 * Creates the table required for Postgrator to keep track of which migrations have been run.
 *
 * @returns {Promise}
 */
Postgrator.prototype.prep = function prep() {
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
