import Client from "./Client.js";
import type { PostgresResolvedOptions } from "../types.js";

class PostgresClient extends Client {
  declare config: PostgresResolvedOptions;

  getAddNameSql(): string {
    return `
      ALTER TABLE ${this.quotedSchemaTable()} 
        ADD COLUMN name TEXT;
    `;
  }

  getAddMd5Sql(): string {
    return `
      ALTER TABLE ${this.quotedSchemaTable()} 
        ADD COLUMN md5 TEXT;
    `;
  }

  getAddRunAtSql(): string {
    return `
      ALTER TABLE ${this.quotedSchemaTable()} 
        ADD COLUMN run_at TIMESTAMP WITH TIME ZONE;
    `;
  }

  getColumnsSql(): string {
    const { config } = this;
    const tableCatalogSql = config.database
      ? `AND table_catalog = '${config.database}'`
      : "";

    // When using pg, if schemaTable has a `.` in it, use it as a
    // schema name.
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
      ${tableCatalogSql}
      ${schemaSql};
    `;
  }
}

export default PostgresClient;
