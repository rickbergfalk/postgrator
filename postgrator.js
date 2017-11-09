const fs = require('fs')
const createCommonClient = require('./lib/create-common-client.js')
const {
  log,
  fileChecksum,
  checksum,
  sortMigrationsAsc,
  sortMigrationsDesc
} = require('./lib/utils.js')

let commonClient
let currentVersion
let targetVersion
let migrations = [] // array of objects like: {version: n, action: 'do', direction: 'up', filename: '0001.up.sql'}

let config = {}

module.exports = {
  config,
  setConfig,
  runQuery,
  endConnection,
  getCurrentVersion,
  getVersions,
  migrate
}

function setConfig(configuration) {
  config = configuration
  config.schemaTable = config.schemaTable || 'schemaversion'
  config.logProgress = config.logProgress != null ? config.logProgress : true

  commonClient = createCommonClient(config)
}

/**
 * Internal
 * Reads all migrations from directory
 */
function getMigrations() {
  // TODO STOP THIS GLOBAL MADNESS
  migrations = []
  const migrationFiles = fs.readdirSync(config.migrationDirectory)
  migrationFiles.forEach(function(file) {
    const m = file.split('.')
    const name = m.length >= 3 ? m.slice(2, m.length - 1).join('.') : file
    const filename = config.migrationDirectory + '/' + file
    if (m[m.length - 1] === 'sql') {
      migrations.push({
        version: Number(m[0]),
        direction: m[1],
        action: m[1],
        filename: file,
        name: name,
        md5: fileChecksum(filename, config.newline),
        getSql: () => fs.readFileSync(filename, 'utf8')
      })
    } else if (m[m.length - 1] === 'js') {
      const jsModule = require(filename)
      const sql = jsModule.generateSql()
      migrations.push({
        version: Number(m[0]),
        direction: m[1],
        action: m[1],
        filename: file,
        name: name,
        md5: checksum(sql, config.newline),
        getSql: () => sql
      })
    }
  })
}

/**
 * Exposed for testing, but otherwise internal
 * Connects the database driver if it is not currently connected.
 * Executes an arbitrary sql query using the common client
 * @param {*} query
 * @param {*} cb
 */
function runQuery(query, cb) {
  if (commonClient.connected) {
    commonClient.runQuery(query, cb)
  } else {
    commonClient.createConnection(function(err) {
      if (err) cb(err)
      else {
        commonClient.connected = true
        commonClient.runQuery(query, cb)
      }
    })
  }
}

/**
 * Ends the commonClient's connection to database
 * @param {*} cb
 */
function endConnection(cb) {
  if (commonClient.connected) {
    return commonClient.endConnection(() => {
      commonClient.connected = false
      cb()
    })
  }
  cb()
}

/**
 * Gets the current version of the schema from the database.
 * @param {*} callback
 */
function getCurrentVersion(callback) {
  runQuery(commonClient.queries.getCurrentVersion, (err, result) => {
    if (err) {
      const msg = `Error getting current version from table: ${
        config.schemaTable
      }`
      console.error(msg)
      return callback(err)
    }
    if (result.rows.length > 0) {
      currentVersion = result.rows[0].version
    } else {
      currentVersion = 0
    }
    callback(err, currentVersion)
  })
}

/**
 * Returns an object with current applied version of the schema from
 * the database and max version of migration available
 * @param {*} callback
 */
function getVersions(callback) {
  const versions = {}
  getMigrations()

  versions.migrations = migrations
    .map(migration => migration.version)
    .filter(version => !isNaN(version))

  versions.max = Math.max.apply(null, versions.migrations)

  getCurrentVersion((err, version) => {
    if (err) {
      return callback(err)
    }
    versions.current = version
    callback(null, versions)
  })
}

/**
 * Internal function
 * Runs the migrations in the order provided, using a recursive approach
 * Each relevant migration is run.
 * On error, callback is called and nothing else is run
 * On success, a record is added/removed from config.schemaTable to keep track of the migration we just ran
 * Migrations are run until target version reached.
 */
function runMigrations(
  migrations,
  currentVersion,
  targetVersion,
  finishedCallback
) {
  function runNext(i) {
    const sql = migrations[i].getSql()
    if (migrations[i].md5Sql) {
      log('verifying checksum of migration ' + migrations[i].filename)
      runQuery(migrations[i].md5Sql, (err, result) => {
        if (err) {
          return finishedCallback(err, migrations)
        }
        const row = result.rows[0]
        const m = migrations[i]
        if (row && row.md5 && row.md5 !== m.md5) {
          const msg = `For migration [${m.version}], expected MD5 checksum [${
            m.md5
          }] but got [${row.md5}]`
          return finishedCallback(new Error(msg), migrations)
        }
        i = i + 1
        if (i < migrations.length) {
          return runNext(i)
        }
        return finishedCallback(null, migrations)
      })
    } else {
      log('running ' + migrations[i].filename)
      runQuery(sql, (err, result) => {
        if (err) {
          return finishedCallback(err, migrations)
        }
        // Migration ran successfully. Add version to config.schemaTable table.
        runQuery(migrations[i].schemaVersionSQL, function(err, result) {
          if (err) {
            return finishedCallback(err, migrations)
          }
          // config.schemaTable successfully recorded
          // Continue on to next migration
          i = i + 1
          if (i < migrations.length) {
            return runNext(i)
          }
          // We are done running the migrations.
          return finishedCallback(null, migrations)
        })
      })
    }
  }
  runNext(0)
}

/**
 * returns an array of relevant migrations based on the target and current version passed.
 * returned array is sorted in the order it needs to be run
 * @param {*} currentVersion
 * @param {*} targetVersion
 */
function getRelevantMigrations(currentVersion, targetVersion) {
  let relevantMigrations = []
  if (targetVersion >= currentVersion) {
    // get all up migrations > currentVersion and <= targetVersion
    log('migrating up to ' + targetVersion)
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
    log('migrating down to ' + targetVersion)
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
 * @param {*} target - version to migrate as string or number (handled as  numbers internally)
 * @param {*} finishedCallback - called when completed. function (err, migrations)
 */
function migrate(target, finishedCallback) {
  prep(err => {
    if (err) {
      return finishedCallback(err)
    }
    getMigrations()

    if (target === 'max') {
      const versions = migrations
        .map(migration => migration.version)
        .filter(version => !isNaN(version))
      targetVersion = Math.max.apply(null, versions)
    } else if (target) {
      targetVersion = Number(target)
    }

    if (targetVersion === undefined) {
      log('no target version supplied - no migrations performed')
      return finishedCallback('no target version supplied')
    }

    getCurrentVersion((err, currentVersion) => {
      if (err) {
        log('error getting current version')
        return finishedCallback(err)
      }
      log('version of database is: ' + currentVersion)
      const relevantMigrations = getRelevantMigrations(
        currentVersion,
        targetVersion
      )
      if (relevantMigrations.length > 0) {
        return runMigrations(
          relevantMigrations,
          currentVersion,
          targetVersion,
          finishedCallback
        )
      }
      return finishedCallback()
    })
  })
}

/**
 * Creates the table required for Postgrator to keep track of which migrations have been run.
 * @param {*} callback - function called after schema version table is built. function (err, results) {}
 */
function prep(callback) {
  return runQuery(commonClient.queries.checkTable, (err, result) => {
    if (err) {
      err.helpfulDescription = 'Prep() table CHECK query Failed'
      return callback(err)
    }
    if (result.rows && result.rows.length > 0) {
      if (config.driver === 'pg' || config.driver === 'pg.js') {
        // config.schemaTable exists, does it have the md5 column? (PostgreSQL only)
        const sql = `
          SELECT column_name, data_type, character_maximum_length 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE table_name = '${config.schemaTable}' 
          AND column_name = 'md5';
        `
        return runQuery(sql, (err, result) => {
          if (err) {
            err.helpfulDescription =
              'Prep() table CHECK MD5 COLUMN query Failed'
            return callback(err)
          }
          if (!result.rows || result.rows.length === 0) {
            // md5 column doesn't exist, add it
            const sql = `ALTER TABLE ${
              config.schemaTable
            } ADD COLUMN md5 text DEFAULT '';`
            return runQuery(sql, (err, result) => {
              if (err) {
                err.helpfulDescription =
                  'Prep() table ADD MD5 COLUMN query Failed'
                return callback(err)
              }
              return callback()
            })
          }
          return callback()
        })
      }
      return callback()
    }
    log(`table ${config.schemaTable} does not exist - creating it.`)
    return runQuery(commonClient.queries.makeTable, (err, result) => {
      if (err) {
        err.helpfulDescription = 'Prep() table BUILD query Failed'
        return callback(err)
      }
      return callback()
    })
  })
}
