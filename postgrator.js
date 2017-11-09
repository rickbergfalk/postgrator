const fs = require('fs')
const crypto = require('crypto')
const newline = require('newline')
const createCommonClient = require('./lib/create-common-client.js')

let commonClient
let currentVersion
let targetVersion
let migrations = [] // array of objects like: {version: n, action: 'do', direction: 'up', filename: '0001.up.sql'}

let config = {}

exports.config = config

/*  Set Config
================================================================= */
exports.setConfig = function(configuration) {
  config = configuration
  config.schemaTable = config.schemaTable || 'schemaversion'
  config.logProgress = config.logProgress != null ? config.logProgress : true

  commonClient = createCommonClient(config)
}

/*  Migration Sorting Functions
================================================================= */
function sortMigrationsAsc(a, b) {
  if (a.version < b.version) {
    return -1
  }
  if (a.version > b.version) {
    return 1
  }
  return 0
}

function sortMigrationsDesc(a, b) {
  if (a.version < b.version) {
    return 1
  }
  if (a.version > b.version) {
    return -1
  }
  return 0
}

/*
  getMigrations()

  Internal function
  Reads the migration directory for all the migration files.
================================================================= */
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

/*
  runQuery

  connects the database driver if it is not currently connected.
  Executes an arbitrary sql query using the common client
================================================================= */
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
exports.runQuery = runQuery

/*
  endConnection
  Ends the commonClient's connection to the database
================================================================= */
function endConnection(cb) {
  if (commonClient.connected) {
    return commonClient.endConnection(() => {
      commonClient.connected = false
      cb()
    })
  }
  cb()
}
exports.endConnection = endConnection

/*
  getCurrentVersion(callback)

  Internal & External function
  Gets the current version of the schema from the database.
================================================================= */
function getCurrentVersion(callback) {
  runQuery(commonClient.queries.getCurrentVersion, (err, result) => {
    if (err) {
      const msg = `Error getting current version from table: ${config.schemaTable}`
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
exports.getCurrentVersion = getCurrentVersion

/*
  getVersions(callback)

  Internal & External function
  Returns an object with the current applied version of the schema from
  the database and the max version of migration available.
================================================================= */
function getVersions(callback) {
  const versions = {}
  getMigrations()

  versions.migrations = migrations
    .map(migration => migration.version)
    .filter(version => !isNaN(version))

  versions.max = Math.max.apply(null, versions.migrations)

  getCurrentVersion((err, version) => {
    if (err && config.logProgress) {
      log('Error in postgrator{isLatestVersion}', 1)
      log('Error:' + err, 1)
    } else {
      versions.current = version
    }
    callback(err, versions)
  })
}
exports.getVersions = getVersions

/*
  runMigrations(migrations, finishedCallback)

  Internal function
  Runs the migrations in the order provided, using a recursive kind of approach
  For each migration run:
  - the contents of the script is read (sync because I'm lazy)
  - script is run.
    if error, the callback is called and we don't run anything else
    if success, we then add/remove a record from the config.schemaTable to keep track of the migration we just ran
  - if all goes as planned, we run the next migration
  - once all migrations have been run, we call the callback.
================================================================= */
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
          log('Error in runMigrations() while retrieving existing migrations')
          return finishedCallback(err, migrations)
        }
        const row = result.rows[0]
        const m = migrations[i]
        if (row && row.md5 && row.md5 !== m.md5) {
          const msg = `For migration [${m.version}], expected MD5 checksum [${m.md5}] but got [${row.md5}]`
          log('Error verifying checksums of existing migrations')
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
          log('Error in runMigrations()')
          return finishedCallback(err, migrations)
        }
        // Migration ran successfully. Add version to config.schemaTable table.
        runQuery(migrations[i].schemaVersionSQL, function(err, result) {
          if (err) {
            if (config.logProgress) {
              log('error updating the ' + config.schemaTable + ' table', 1)
              log(err, 1)
            }
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

/*
  .getRelevantMigrations(currentVersion, targetVersion)

  returns an array of relevant migrations based on the target and current version passed.
  returned array is sorted in the order it needs to be run
================================================================= */
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
        migration.md5Sql = `SELECT md5 FROM ${config.schemaTable} WHERE version = ${migration.version};`
        relevantMigrations.push(migration)
      }
      if (
        migration.action === 'do' &&
        migration.version > currentVersion &&
        migration.version <= targetVersion
      ) {
        migration.schemaVersionSQL =
          config.driver === 'pg'
            ? `INSERT INTO ${config.schemaTable} (version, name, md5) VALUES (${migration.version}, '${migration.name}', '${migration.md5}');`
            : `INSERT INTO ${config.schemaTable} (version) VALUES (${migration.version});`
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
        migration.schemaVersionSQL = `DELETE FROM ${config.schemaTable} WHERE version = ${migration.version};`
        relevantMigrations.push(migration)
      }
    })
    relevantMigrations = relevantMigrations.sort(sortMigrationsDesc)
  }
  return relevantMigrations
}

/*
  .migrate(target, callback)

  Main method to move a schema to a particular version.
  A target must be specified, otherwise nothing is run.

  target - version to migrate to as string or number (will be handled as numbers internally)
  callback - callback to run after migrations have finished. function (err, migrations) {}
================================================================= */
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
exports.migrate = migrate

/*
  .prep(callback)

  Creates the table required for Postgrator to keep track of which migrations have been run.

  callback - function called after schema version table is built. function (err, results) {}
================================================================= */
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
            const sql = `ALTER TABLE ${config.schemaTable} ADD COLUMN md5 text DEFAULT '';`
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

/**
 * 
 * @param {string} message - The message to log
 * @param {boolean} alwaysLog - optional boolean value, set to 1 to log a message (like an error) regardless of the users logging preferences.
 */
function log(message, alwaysLog) {
  if (config.logProgress || alwaysLog) {
    const prefix = '[' + new Date().toLocaleTimeString() + ']'
    console.log(prefix + ' ' + message)
  }
}

/**
 * Calculate checksum of file to detect changes to migrations that have already run.
 * @param {string} filename 
 * @param {string} lineEnding - newline setting string for newline lib
 */
function fileChecksum(filename, lineEnding) {
  const content = fs.readFileSync(filename, 'utf8')
  return checksum(content, lineEnding)
}

/**
 * 
 * @param {string} content - Content to checksum
 * @param {string} lineEnding - newline setting string for newline lib
 */
function checksum(content, lineEnding) {
  if (lineEnding) {
    log(
      `Converting newline from: ${lineEnding.detect(content)} to: ${lineEnding}`
    )
    content = newline.set(content, lineEnding)
  }
  return crypto
    .createHash('md5')
    .update(content, 'utf8')
    .digest('hex')
}
