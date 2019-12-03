const Client = require('./Client')

class PostgresClient extends Client {
  getTimestampType() {
    return 'TIMESTAMP WITH TIME ZONE'
  }

  _createConnection() {
    const { config, dbDriver } = this
    if (config.username) {
      config.user = config.username
    }

    if (config.ssl) {
      dbDriver.defaults.ssl = true
    }

    const dbConnection = new dbDriver.Client(config.connectionString || config)
    this.dbConnection = dbConnection

    // pg 6.x does not return promise on connect()
    // This wrapper should allow 6.x and 7.x compatibility
    return new Promise((resolve, reject) => {
      dbConnection.connect(err => {
        if (err) return reject(err)
        if (config.currentSchema) {
          return dbConnection.query(
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

  _runQuery(query) {
    return this.dbConnection.query(query)
  }

  // pg 6.x does not return promise on end()
  // This wrapper should allow 6.x and 7.x compatibility
  _endConnection() {
    return new Promise((resolve, reject) => {
      // Managed PG on Azure doesn't respond to end request
      // We'll give it time to to respond and then assume success
      const timeout = setTimeout(resolve, 1000)

      this.dbConnection.end(err => {
        clearTimeout(timeout)
        if (err) {
          return reject(err)
        }
        return resolve()
      })
    })
  }
}

module.exports = PostgresClient
