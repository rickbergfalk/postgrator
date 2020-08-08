const Client = require('./Client')
const utils = require('./utils')

class PostgresClient extends Client {

  charIsUpperCase(chr) {
    return chr != chr.toLowerCase() && chr == chr.toUpperCase()
  }

  getName(name){
   
    if(this.charIsUpperCase(name[0])){
      return `"${name}"`;
    }
    return name;
  }

  getSchemaTableName(schemaTable){

    const schemaTableParts = schemaTable.split('.');
    const schema = schemaTableParts[0]
    const table = schemaTableParts[1]
    
    if(schema.length > 1){
      return  `${this.getName(schema)}.${this.getName(table)}`
    }
  }

  getAddNameSql() {
    const { config } = this;

    return `
      ALTER TABLE ${this.getSchemaTableName(config.schemaTable)}
        ADD COLUMN name TEXT;
    `
  }

  getAddMd5Sql() {

    const { config } = this;

    return `
      ALTER TABLE ${this.getSchemaTableName(config.schemaTable)}
        ADD COLUMN md5 TEXT;
    `
  }

  getAddRunAtSql() {
    const { config } = this;
    return `
      ALTER TABLE ${this.getSchemaTableName(config.schemaTable)} 
        ADD COLUMN run_at TIMESTAMP WITH TIME ZONE;
    `
  }

  persistActionSql(migration) {
    const { config } = this
    const action = migration.action.toLowerCase()
    if (action === 'do') {
      return `
          INSERT INTO ${this.getSchemaTableName(config.schemaTable)} (version, name, md5, run_at) 
          VALUES (
            ${migration.version}, 
            '${migration.name}', 
            '${migration.md5}',
            '${new Date().toISOString().replace('T', ' ').replace('Z', '')}'
          );`
    }
    if (action === 'undo') {
      return `
          DELETE FROM ${this.getSchemaTableName(config.schemaTable)}
          WHERE version = ${migration.version};`
    }
    throw new Error('unknown migration action')
  }

  getMd5Sql(migration) {
    const { config } = this
  
    return `
      SELECT md5 
      FROM ${this.getSchemaTableName(config.schemaTable)}
      WHERE version = ${migration.version};
    `
}

  getDatabaseVersionSql() {
    const { config } = this
    return `
      SELECT version 
      FROM ${this.getSchemaTableName(config.schemaTable)}
      ORDER BY version DESC 
      LIMIT 1
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
          CREATE TABLE ${this.getSchemaTableName(config.schemaTable)} (
            version BIGINT PRIMARY KEY
          ); 
          INSERT INTO ${this.getSchemaTableName(config.schemaTable)} (version) 
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
