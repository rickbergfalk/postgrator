import Client from "./Client.js";

class MysqlClient extends Client {
  getAddNameSql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN name TEXT;
    `;
  }

  getAddMd5Sql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN md5 TEXT;
    `;
  }

  getAddRunAtSql() {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN run_at TIMESTAMP;
    `;
  }

  getColumnsSql() {
    return `
      SELECT column_name
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE table_name = '${this.config.schemaTable}'
      AND table_schema = '${this.config.database}';
    `;
  }
}

export default MysqlClient;
