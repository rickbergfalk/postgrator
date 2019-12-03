const Client = require('./Client')

class MysqlClient extends Client {
  getTimestampType() {
    return 'TIMESTAMP'
  }

  _createConnection() {
    const { dbDriver, config } = this
    return new Promise((resolve, reject) => {
      const connection = dbDriver.createConnection({
        multipleStatements: true,
        host: config.host,
        port: config.port,
        user: config.username || config.user,
        password: config.password,
        database: config.database,
        ssl: config.ssl
      })
      this.dbConnection = connection
      connection.connect(err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  _runQuery(query) {
    const { dbConnection } = this
    return new Promise((resolve, reject) => {
      dbConnection.query(query, (err, rows, fields) => {
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

  _endConnection() {
    const { dbConnection } = this
    return new Promise((resolve, reject) => {
      dbConnection.end(err => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

module.exports = MysqlClient
