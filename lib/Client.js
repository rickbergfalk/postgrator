const utils = require('./utils')

class Client {
  constructor(config) {
    this.config = config
    this.connected = false
    this.dbConnection = null
    try {
      this.dbDriver = require(config.driver)
    } catch (e) {
      console.error(`Did you forget to run "npm install ${config.driver}"?`)
      throw e
    }
  }

  persistActionSql(migration) {
    const { config } = this
    const action = migration.action.toLowerCase()
    if (action === 'do') {
      return `
          INSERT INTO ${config.schemaTable} (version, name, md5, run_at) 
          VALUES (
            ${migration.version}, 
            '${migration.name}', 
            '${migration.md5}',
            '${new Date().toISOString().replace('T', ' ').replace('Z', '')}'
          );`
    }
    if (action === 'undo') {
      return `
          DELETE FROM ${config.schemaTable} 
          WHERE version = ${migration.version};`
    }
    throw new Error('unknown migration action')
  }

  getMd5Sql(migration) {
    const { config } = this
    return `
      SELECT md5 
      FROM ${config.schemaTable} 
      WHERE version = ${migration.version};
    `
  }

  getDatabaseVersionSql() {
    const { config } = this
    return `
      SELECT version 
      FROM ${config.schemaTable} 
      ORDER BY version DESC 
      LIMIT 1
    `
  }

  runQuery(query) {
    if (this.connected) {
      return this._runQuery(query)
    } else {
      return this._createConnection().then(() => {
        this.connected = true
        return this._runQuery(query)
      })
    }
  }

  endConnection() {
    if (this.connected) {
      return this._endConnection().then(() => {
        this.connected = false
      })
    }
    return Promise.resolve()
  }

  ensureTable() {
    const { config } = this

    const sql = this.getColumnsSql()
    return this.runQuery(sql).then((results) => {
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
        sqls.push(this.getAddNameSql())
      }
      if (!utils.hasColumnName(rows, 'md5')) {
        sqls.push(this.getAddMd5Sql())
      }
      if (!utils.hasColumnName(rows, 'run_at')) {
        sqls.push(this.getAddRunAtSql())
      }
      let sequence = Promise.resolve()
      sqls.forEach((sql) => {
        sequence = sequence.then(() => this.runQuery(sql))
      })
      return sequence
    })
  }
}

module.exports = Client
