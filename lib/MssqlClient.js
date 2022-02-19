import Client from "./Client.js";

class MssqlClient extends Client {
  getAddNameSql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD name VARCHAR(MAX);
    `;
  }

  getAddMd5Sql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD md5 VARCHAR(MAX);
    `;
  }

  getAddRunAtSql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD run_at DATETIME;
    `;
  }

  getColumnsSql() {
    const { config } = this;
    const schema = config.schemaTable.split(".");
    let tableName = schema[0];
    let schemaSql = "";

    if (schema[1]) {
      tableName = schema[1];
      schemaSql = `AND table_schema = '${schema[0]}'`;
    } else if (config.currentSchema) {
      schemaSql = `AND table_schema = '${config.currentSchema}'`;
    }

    return `
      SELECT column_name
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE table_name = '${tableName}'
      AND table_catalog = '${config.database}'
      ${schemaSql};
    `;
  }

  getDatabaseVersionSql() {
    const { config } = this;
    return `
      SELECT TOP 1 version 
      FROM ${config.schemaTable} 
      ORDER BY version DESC
    `;
  }
}

export default MssqlClient;
