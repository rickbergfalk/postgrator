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
    createConnection: Promise.resolve(),
    runQuery: Promise.resolve(),
    endConnection: Promise.resolve(),
    queries: {
      getCurrentVersion: `
        SELECT version 
        FROM ${config.schemaTable} 
        ORDER BY version DESC 
        LIMIT 1`,
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

    commonClient.createConnection = () => {
      return new Promise((resolve, reject) => {
        const connection = commonClient.dbDriver.createConnection({
          multipleStatements: true,
          host: config.host,
          port: config.port,
          user: config.username,
          password: config.password,
          database: config.database
        })
        commonClient.dbConnection = connection
        connection.connect(err => {
          if (err) return reject(err)
          resolve()
        })
      })
    }

    commonClient.runQuery = query => {
      return new Promise((resolve, reject) => {
        commonClient.dbConnection.query(query, (err, rows, fields) => {
          if (err) {
            return reject(err)
          }
          const results = {}
          if (rows) results.rows = rows
          if (fields) results.fields = fields
          resolve(results)
        })
      })
    }

    commonClient.endConnection = () => {
      return new Promise((resolve, reject) => {
        commonClient.dbConnection.end(err => {
          if (err) return reject(err)
          resolve()
        })
      })
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

    commonClient.createConnection = () => {
      if (config.username) {
        config.user = config.username
      }
      commonClient.dbConnection = new commonClient.dbDriver.Client(
        config.connectionString || config
      )
      return commonClient.dbConnection.connect()
    }

    commonClient.runQuery = query => commonClient.dbConnection.query(query)

    commonClient.endConnection = () => commonClient.dbConnection.end()
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

    commonClient.createConnection = cb => {
      return commonClient.dbDriver.connect(sqlconfig).then(connection => {
        commonClient.dbConnection = connection
      })
    }

    commonClient.runQuery = query => {
      return new Promise((resolve, reject) => {
        const request = new commonClient.dbDriver.Request()
        const batches = query.split(/^\s*GO\s*$/im)

        function runBatch(batchIndex) {
          request.batch(batches[batchIndex], (err, result) => {
            if (err) {
              return reject(err)
            }
            if (batchIndex === batches.length - 1) {
              return resolve({
                rows: result && result.recordset ? result.recordset : result
              })
            }
            return runBatch(batchIndex + 1)
          })
        }

        runBatch(0)
      })
    }

    commonClient.endConnection = () => {
      commonClient.dbConnection.close()
      return Promise.resolve()
    }
  }

  return commonClient
}