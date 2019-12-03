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

    return this.runQuery(sql).then(results => {
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
        const datatype = this.getTimestampType()
        sqls.push(
          `ALTER TABLE ${config.schemaTable} ADD ${columnKeyword} run_at ${datatype};`
        )
      }
      let sequence = Promise.resolve()
      sqls.forEach(sql => {
        sequence = sequence.then(() => this.runQuery(sql))
      })
      return sequence
    })
  }
}

module.exports = Client
