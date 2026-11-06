import Client from "./Client.js";
import type { Sqlite3ResolvedOptions } from "../types.js";

class Sqlite3Client extends Client {
  declare config: Sqlite3ResolvedOptions;

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

    const query = `
      SELECT name AS column_name
      FROM pragma_table_info('${config.schemaTable}')
    `;

    return query;
  }
}

export default Sqlite3Client;
