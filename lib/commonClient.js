const utils = require('./utils')

const DRIVERS = ['pg', 'mysql', 'mssql']

const TIMESTAMP_TYPES = {
  pg: 'TIMESTAMP WITH TIME ZONE',
  mysql: 'TIMESTAMP',
  mssql: 'DATETIME'
}

module.exports = function(config) {
  if (DRIVERS.indexOf(config.driver) === -1) {
    throw new Error(
      'db driver not supported. Must one of: ' + DRIVERS.join(', ')
    )
  }

  const commonClient = {
    connected: false,
    dbDriver: null,
    dbConnection: null,
    createConnection: () => Promise.resolve(),
    runQuery: () => Promise.resolve(),
    endConnection: () => Promise.resolve(),
    persistActionSql: migration => {
      const action = migration.action.toLowerCase()
      if (action === 'do') {
        return `
          INSERT INTO ${config.schemaTable} (version, name, md5, run_at) 
          VALUES (
            ${migration.version}, 
            '${migration.name}', 
            '${migration.md5}',
            '${new Date()
              .toISOString()
              .replace('T', ' ')
              .replace('Z', '')}'
          );`
      }
      if (action === 'undo') {
        return `
          DELETE FROM ${config.schemaTable} 
          WHERE version = ${migration.version};`
      }
      throw new Error('unknown migration action')
    },
    queries: {
      getMd5: migration => `
        SELECT md5 
        FROM ${config.schemaTable} 
        WHERE version = ${migration.version};
      `,
      getDatabaseVersion: `
        SELECT version 
        FROM ${config.schemaTable} 
        ORDER BY version DESC 
        LIMIT 1`
    }
  }

  if (config.driver === 'mysql') {
    createMysql(config, commonClient)
  } else if (config.driver === 'pg') {
    createPostgres(config, commonClient)
  } else if (config.driver === 'mssql') {
    createMssql(config, commonClient)
  }

  commonClient.runQuery = query => {
    if (commonClient.connected) {
      return commonClient._runQuery(query)
    } else {
      return commonClient._createConnection().then(() => {
        commonClient.connected = true
        return commonClient._runQuery(query)
      })
    }
  }

  commonClient.endConnection = () => {
    if (commonClient.connected) {
      return commonClient._endConnection().then(() => {
        commonClient.connected = false
      })
    }
    return Promise.resolve()
  }

  commonClient.ensureTable = () => {
    let sql = ''
    let textType = 'TEXT'
    let columnKeyword = 'COLUMN'

    if (config.driver === 'pg') {
      const schemaSql = config.database
        ? `AND table_catalog = '${config.database}'`
        : ''

      sql = `
        SELECT column_name
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_name = '${config.schemaTable}'
        ${schemaSql};
      `
    } else if (config.driver === 'mssql') {
      textType = 'VARCHAR(MAX)'
      columnKeyword = ''
      sql = `
        SELECT column_name
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_name = '${config.schemaTable}'
        AND table_catalog = '${config.database}';
      `
    } else if (config.driver === 'mysql') {
      sql = `
        SELECT column_name
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_name = '${config.schemaTable}'
        AND table_schema = '${config.database}';
      `
    }

    return commonClient.runQuery(sql).then(results => {
      const sqls = []
      if (results.rows.length === 0) {
        sqls.push(`
          CREATE TABLE ${config.schemaTable} (
            version BIGINT PRIMARY KEY
          ); 
          INSERT INTO ${config.schemaTable} (version) 
            VALUES (0);
        `)
      }
      if (!results.rows.find(row => row.column_name === 'name')) {
        sqls.push(
          `ALTER TABLE ${config.schemaTable} ADD ${columnKeyword} name ${
            textType
          };`
        )
      }
      if (!results.rows.find(row => row.column_name === 'md5')) {
        sqls.push(
          `ALTER TABLE ${config.schemaTable} ADD ${columnKeyword} md5 ${
            textType
          };`
        )
      }
      if (!results.rows.find(row => row.column_name === 'run_at')) {
        sqls.push(
          `ALTER TABLE ${config.schemaTable} ADD ${columnKeyword} run_at ${
            TIMESTAMP_TYPES[config.driver]
          };`
        )
      }
      let sequence = Promise.resolve()
      sqls.forEach(sql => {
        sequence = sequence.then(() => commonClient.runQuery(sql))
      })
      return sequence
    })
  }

  return commonClient
}

function createMysql(config, commonClient) {
  try {
    commonClient.dbDriver = require('mysql')
  } catch (e) {
    console.error('Did you forget to run "npm install mysql"?')
    throw e
  }
  utils.supportWarning('mysql', 2, 2)

  commonClient._createConnection = () => {
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

  commonClient._runQuery = query => {
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

  commonClient._endConnection = () => {
    return new Promise((resolve, reject) => {
      commonClient.dbConnection.end(err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  return commonClient
}

function createPostgres(config, commonClient) {
  try {
    commonClient.dbDriver = require('pg')
  } catch (e) {
    console.error('Did you forget to run "npm install pg"?')
    throw e
  }
  utils.supportWarning('pg', 6, 7)

  if (config.ssl) {
    commonClient.dbDriver.defaults.ssl = true
  }

  commonClient._createConnection = () => {
    if (config.username) {
      config.user = config.username
    }
    commonClient.dbConnection = new commonClient.dbDriver.Client(
      config.connectionString || config
    )
    // pg 6.x does not return promise on connect()
    // This wrapper should allow 6.x and 7.x compatibility
    return new Promise((resolve, reject) => {
      commonClient.dbConnection.connect(err => {
        if (err) return reject(err)
        return resolve()
      })
    })
  }

  commonClient._runQuery = query => commonClient.dbConnection.query(query)

  // pg 6.x does not return promise on end()
  // This wrapper should allow 6.x and 7.x compatibility
  commonClient._endConnection = () => {
    return new Promise((resolve, reject) => {
      commonClient.dbConnection.end(err => {
        if (err) return reject(err)
        return resolve()
      })
    })
  }
}

function createMssql(config, commonClient) {
  try {
    commonClient.dbDriver = require('mssql')
  } catch (e) {
    console.error('Did you forget to run "npm install mssql"?')
    throw e
  }
  utils.supportWarning('mssql', 4, 4)

  const oneHour = 1000 * 60 * 60

  const sqlconfig = {
    user: config.username,
    password: config.password,
    server: config.host,
    port: config.port,
    database: config.database,
    options: config.options,
    requestTimeout: config.requestTimeout || oneHour,
    connectionTimeout: config.connectionTimeout || 15000,
    pool: {
      max: 1,
      min: 1
    }
  }

  commonClient.queries.getDatabaseVersion = `
    SELECT TOP 1 version 
    FROM ${config.schemaTable} 
    ORDER BY version DESC`

  commonClient._createConnection = () => {
    commonClient.dbConnection = new commonClient.dbDriver.ConnectionPool(
      sqlconfig
    )
    return commonClient.dbConnection.connect()
  }

  commonClient._runQuery = query => {
    return new Promise((resolve, reject) => {
      const request = new commonClient.dbDriver.Request(
        commonClient.dbConnection
      )
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

  commonClient._endConnection = () => {
    commonClient.dbConnection.close()
    return Promise.resolve()
  }
}
