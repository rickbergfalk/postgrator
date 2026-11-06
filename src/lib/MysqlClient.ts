import Client from "./Client.js";
import type { MySQLResolvedOptions } from "../types.js";

class MysqlClient extends Client {
  declare config: MySQLResolvedOptions;

  getAddNameSql(): string {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN name TEXT;
    `;
  }

  getAddMd5Sql(): string {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN md5 TEXT;
    `;
  }

  getAddRunAtSql(): string {
    return `
      ALTER TABLE ${this.config.schemaTable} 
        ADD COLUMN run_at TIMESTAMP;
    `;
  }

  getColumnsSql(): string {
    return `
      SELECT column_name
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE table_name = '${this.config.schemaTable}'
      AND table_schema = '${this.config.database}';
    `;
  }
}

export default MysqlClient;
