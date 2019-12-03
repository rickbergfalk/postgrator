const utils = require('./utils')

const DRIVERS = [
  { package: 'pg', min: 6, max: 7 },
  { package: 'mysql', min: 2, max: 2 },
  { package: 'mysql2', min: 1, max: 2 },
  { package: 'mssql', min: 4, max: 6 }
]

const TIMESTAMP_TYPES = {
  pg: 'TIMESTAMP WITH TIME ZONE',
  mysql: 'TIMESTAMP',
  mysql2: 'TIMESTAMP',
  mssql: 'DATETIME'
}

module.exports = function(config) {
  const driver = DRIVERS.find(d => d.package === config.driver)

  if (!driver) {
    throw new Error(
      `db driver '${config.driver}' not supported. Must one of: '${DRIVERS.map(
        x => x.package
      ).join("', '")}'`
    )
  }

  utils.supportWarning(driver.package, driver.min, driver.max)

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

  if (config.driver === 'mysql' || config.driver === 'mysql2') {
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
      const tableCatalogSql = config.database
        ? `AND table_catalog = '${config.database}'`
        : ''

      // When using pg, if schemaTable has a `.` in it, use it as a
      // schema name.
      const schema = config.schemaTable.split('.')
      let tableName = schema[0]
      let schemaSql = ''

      if (schema[1]) {
        tableName = schema[1]
        schemaSql = `AND table_schema = '${schema[0]}'`
      } else if (config.currentSchema) {
        schemaSql = `AND table_schema = '${config.currentSchema}'`
      }

      sql = `
        SELECT column_name
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_name = '${tableName}'
        ${tableCatalogSql}
        ${schemaSql};
      `
    } else if (config.driver === 'mssql') {
      textType = 'VARCHAR(MAX)'
      columnKeyword = ''

      const schema = config.schemaTable.split('.')
      let tableName = schema[0]
      let schemaSql = ''

      if (schema[1]) {
        tableName = schema[1]
        schemaSql = `AND table_schema = '${schema[0]}'`
      } else if (config.currentSchema) {
        schemaSql = `AND table_schema = '${config.currentSchema}'`
      }

      sql = `
        SELECT column_name
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_name = '${tableName}'
        AND table_catalog = '${config.database}'
        ${schemaSql};
      `
    } else if (config.driver === 'mysql' || config.driver === 'mysql2') {
      sql = `
        SELECT column_name
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_name = '${config.schemaTable}'
        AND table_schema = '${config.database}';
      `
    }

    return commonClient.runQuery(sql).then(results => {
      const { rows } = results
      const sqls = []

      if (rows.length === 0) {
        if (config.driver === 'pg') {
          // When using pg, create a schema if schemaTable has a `.` in it
          const schema = config.schemaTable.split('.')
          if (schema[1]) {
            sqls.push(`CREATE SCHEMA IF NOT EXISTS ${schema[0]};`)
          }
        }

        sqls.push(`
          CREATE TABLE ${config.schemaTable} (
            version BIGINT PRIMARY KEY
          ); 
          INSERT INTO ${config.schemaTable} (version) 
            VALUES (0);
        `)
      }
      if (!utils.hasColumnName(rows, 'name')) {
        sqls.push(
          `ALTER TABLE ${config.schemaTable} ADD ${columnKeyword} name ${textType};`
        )
      }
      if (!utils.hasColumnName(rows, 'md5')) {
        sqls.push(
          `ALTER TABLE ${config.schemaTable} ADD ${columnKeyword} md5 ${textType};`
        )
      }
      if (!utils.hasColumnName(rows, 'run_at')) {
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
    commonClient.dbDriver = require(config.driver)
  } catch (e) {
    console.error(`Did you forget to run "npm install ${config.driver}"?`)
    throw e
  }

  commonClient._createConnection = () => {
    return new Promise((resolve, reject) => {
      const connection = commonClient.dbDriver.createConnection({
        multipleStatements: true,
        host: config.host,
        port: config.port,
        user: config.username || config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl
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
        if (config.currentSchema) {
          return commonClient.dbConnection.query(
            `SET search_path = ${config.currentSchema}`,
            err => {
              if (err) return reject(err)
              return resolve()
            }
          )
        }
        return resolve()
      })
    })
  }

  commonClient._runQuery = query => commonClient.dbConnection.query(query)

  // pg 6.x does not return promise on end()
  // This wrapper should allow 6.x and 7.x compatibility
  commonClient._endConnection = () => {
    return new Promise((resolve, reject) => {
      // Managed PG on Azure doesn't respond to end request
      // We'll give it time to to respond and then assume success
      const timeout = setTimeout(resolve, 1000)

      commonClient.dbConnection.end(err => {
        clearTimeout(timeout)
        if (err) {
          return reject(err)
        }
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

  const oneHour = 1000 * 60 * 60

  const sqlconfig = {
    user: config.username,
    password: config.password,
    server: config.host,
    port: config.port,
    database: config.database,
    domain: config.domain,
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
