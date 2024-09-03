import Client from "./Client.js";

class Sqlite3Client extends Client {
  getAddNameSql() {
    return `
      ALTER TABLE ${this.quotedSchemaTable()} 
        ADD COLUMN name TEXT;
    `;
  }

  getAddMd5Sql() {
    return `
      ALTER TABLE ${this.quotedSchemaTable()} 
        ADD COLUMN md5 TEXT;
    `;
  }

  getAddRunAtSql() {
    return `
      ALTER TABLE ${this.quotedSchemaTable()} 
        ADD COLUMN run_at TIMESTAMP WITH TIME ZONE;
    `;
  }

  getColumnsSql() {
    const { config } = this;

    const query = `
      SELECT name AS column_name
      FROM pragma_table_info('${config.schemaTable}')
    `;

    return query;
  }
}

export default Sqlite3Client;
