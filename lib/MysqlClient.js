const Client = require('./Client')

class MysqlClient extends Client {
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
        ADD COLUMN run_at TIMESTAMP;
    `
  }

  getColumnsSql() {
    return `
      SELECT column_name
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE table_name = '${this.config.schemaTable}'
      AND table_schema = '${this.config.database}';
    `
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
        ssl: config.ssl,
      })
      this.dbConnection = connection
      connection.connect((err) => {
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
        const results = { rows, fields }
        resolve(results)
      })
    })
  }

  _endConnection() {
    const { dbConnection } = this
    return new Promise((resolve, reject) => {
      dbConnection.end((err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}

module.exports = MysqlClient
