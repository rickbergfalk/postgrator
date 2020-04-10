const Client = require('./Client')

class PostgresClient extends Client {
  getAddNameSql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN name TEXT;
    `
  }

  getAddMd5Sql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN md5 TEXT;
    `
  }

  getAddRunAtSql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN run_at TIMESTAMP WITH TIME ZONE;
    `
  }

  getColumnsSql() {
    const { config } = this
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

    return `
      SELECT column_name
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE table_name = '${tableName}'
      ${tableCatalogSql}
      ${schemaSql};
    `
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
      dbConnection.connect((err) => {
        if (err) return reject(err)
        if (config.currentSchema) {
          return dbConnection.query(
            `SET search_path = ${config.currentSchema}`,
            (err) => {
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

      this.dbConnection.end((err) => {
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
