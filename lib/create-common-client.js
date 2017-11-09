const supportedDrivers = ['pg', 'mysql', 'mssql']

module.exports = function(config) {
  if (supportedDrivers.indexOf(config.driver) === -1) {
    throw new Error(
      'db driver not supported. Must one of: ' + supportedDrivers.join(', ')
    )
  }

  const commonClient = {
    connected: false,
    dbDriver: null,
    dbConnection: null,
    schemaTable: config.schemaTable,
    createConnection: () => {},
    runQuery: (query, cb) => cb(),
    endConnection: cb => cb(),
    queries: {
      getCurrentVersion: `SELECT version FROM ${
        config.schemaTable
      } ORDER BY version DESC LIMIT 1`,
      checkTable: '',
      makeTable: ''
    }
  }

  if (config.driver === 'mysql') {
    try {
      commonClient.dbDriver = require('mysql')
    } catch (e) {
      console.error('Did you forget to run "npm install mysql"?')
      throw e
    }

    commonClient.queries.checkTable = `
      SELECT * 
      FROM information_schema.tables 
      WHERE table_schema = '${config.database}' 
      AND table_name = '${config.schemaTable}';`

    commonClient.queries.makeTable = `
      CREATE TABLE ${config.schemaTable} (
        version BIGINT, 
        PRIMARY KEY (version)
      ); 
      INSERT INTO ${config.schemaTable} (version) 
        VALUES (0);`

    commonClient.createConnection = function(cb) {
      const connection = commonClient.dbDriver.createConnection({
        multipleStatements: true,
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database
      })
      commonClient.dbConnection = connection
      connection.connect(cb)
    }

    commonClient.runQuery = function(query, cb) {
      commonClient.dbConnection.query(query, function(err, rows, fields) {
        if (err) {
          cb(err)
        } else {
          const results = {}
          if (rows) results.rows = rows
          if (fields) results.fields = fields
          cb(err, results)
        }
      })
    }

    commonClient.endConnection = function(cb) {
      commonClient.dbConnection.end(cb)
    }
  } else if (config.driver === 'pg') {
    try {
      commonClient.dbDriver = require('pg')
    } catch (e) {
      console.error('Did you forget to run "npm install pg"?')
      throw e
    }
    if (config.ssl) {
      commonClient.dbDriver.defaults.ssl = true
    }

    commonClient.queries.checkTable = `
      SELECT * 
      FROM pg_catalog.pg_tables 
      WHERE schemaname = CURRENT_SCHEMA 
      AND tablename = '${config.schemaTable}';`

    commonClient.queries.makeTable = `
      CREATE TABLE ${config.schemaTable} (
        version BIGINT PRIMARY KEY, 
        name TEXT DEFAULT '', 
        md5 TEXT DEFAULT ''
      ); 
      INSERT INTO ${config.schemaTable} (version, name, md5) 
        VALUES (0, '', '');`

    commonClient.createConnection = function(cb) {
      if (config.username) {
        config.user = config.username
      }
      commonClient.dbConnection = new commonClient.dbDriver.Client(
        config.connectionString || config
      )
      commonClient.dbConnection.connect(cb)
    }

    commonClient.runQuery = function(query, cb) {
      commonClient.dbConnection.query(query, function(err, result) {
        cb(err, result)
      })
    }

    commonClient.endConnection = function(cb) {
      commonClient.dbConnection.end()
      process.nextTick(cb)
    }
  } else if (config.driver === 'mssql') {
    try {
      commonClient.dbDriver = require('mssql')
    } catch (e) {
      console.error('Did you forget to run "npm install mssql"?')
      throw e
    }

    const oneHour = 1000 * 60 * 60

    const sqlconfig = {
      user: config.username,
      password: config.password,
      server: config.host,
      port: config.port,
      database: config.database,
      options: config.options,
      requestTimeout: config.requestTimeout || oneHour
    }

    commonClient.queries.getCurrentVersion = `
      SELECT TOP 1 version 
      FROM ${config.schemaTable} 
      ORDER BY version DESC`

    commonClient.queries.checkTable = `
      SELECT * 
      FROM information_schema.tables 
      WHERE table_schema = 'dbo' 
      AND table_name = '${config.schemaTable}'`

    commonClient.queries.makeTable = `
      CREATE TABLE ${config.schemaTable} (
        version BIGINT PRIMARY KEY
      ); 
      INSERT INTO ${config.schemaTable} (version) 
        VALUES (0);`

    commonClient.createConnection = function(cb) {
      commonClient.dbConnection = commonClient.dbDriver.connect(sqlconfig, cb)
    }

    commonClient.runQuery = function(query, cb) {
      const request = new commonClient.dbDriver.Request()
      const batches = query.split(/^\s*GO\s*$/im)

      function runBatch(batchIndex) {
        request.batch(batches[batchIndex], function(err, result) {
          if (err || batchIndex === batches.length - 1) {
            cb(err, {
              rows: result && result.recordset ? result.recordset : result
            })
          } else {
            runBatch(batchIndex + 1)
          }
        })
      }

      runBatch(0)
    }

    commonClient.endConnection = function(cb) {
      commonClient.dbConnection.close()
      cb()
    }
  }

  return commonClient
}
