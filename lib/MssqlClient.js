const Client = require('./Client')

const oneHour = 1000 * 60 * 60

class MssqlClient extends Client {
  getTimestampType() {
    return 'DATETIME'
  }

  getDatabaseVersionSql() {
    const { config } = this
    return `
      SELECT TOP 1 version 
      FROM ${config.schemaTable} 
      ORDER BY version DESC
    `
  }

  _createConnection() {
    const { config, dbDriver } = this

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

    this.dbConnection = new dbDriver.ConnectionPool(sqlconfig)
    return this.dbConnection.connect()
  }

  _runQuery(query) {
    const { dbDriver, dbConnection } = this
    return new Promise((resolve, reject) => {
      const request = new dbDriver.Request(dbConnection)
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

  _endConnection() {
    this.dbConnection.close()
    return Promise.resolve()
  }
}

module.exports = MssqlClient
