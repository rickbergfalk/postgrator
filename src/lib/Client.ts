import type { Migration, ResolvedOptions } from "../types.js";

/**
 * Check if schema rows has row for column name
 * Checks field column_name and COLUMN_NAME due to db/driver quirks
 * @param schemaResultRows
 * @param columnName
 */
function hasColumnName(
  schemaResultRows: Array<Record<string, any>>,
  columnName: string
): boolean {
  const row = schemaResultRows.find(
    (row) => row.column_name === columnName || row.COLUMN_NAME === columnName
  );
  return row !== undefined;
}

abstract class Client {
  config: ResolvedOptions;

  constructor(config: ResolvedOptions) {
    this.config = config;
  }

  abstract getColumnsSql(): string;
  abstract getAddNameSql(): string;
  abstract getAddMd5Sql(): string;
  abstract getAddRunAtSql(): string;

  quotedSchemaTable(): string {
    if (this.config.driver === "pg") {
      return this.config.schemaTable
        .split(".")
        .map((value) => `"${value}"`)
        .join(".");
    }
    return this.config.schemaTable;
  }

  persistActionSql(migration: Migration): string {
    const action = migration.action.toLowerCase();
    if (action === "do") {
      return `
          INSERT INTO ${this.quotedSchemaTable()} (version, name, md5, run_at) 
          VALUES (
            ${migration.version}, 
            '${migration.name}', 
            '${migration.md5}',
            '${new Date().toISOString().replace("T", " ").replace("Z", "")}'
          );`;
    }
    if (action === "undo") {
      return `
          DELETE FROM ${this.quotedSchemaTable()} 
          WHERE version = ${migration.version};`;
    }
    throw new Error("unknown migration action");
  }

  getMd5Sql(migration: Migration): string {
    return `
      SELECT md5 
      FROM ${this.quotedSchemaTable()} 
      WHERE version = ${migration.version};
    `;
  }

  getDatabaseVersionSql(): string {
    return `
      SELECT version 
      FROM ${this.quotedSchemaTable()} 
      ORDER BY version DESC 
      LIMIT 1
    `;
  }

  async runQuery(query: string) {
    const { config } = this;
    if (config.driver === "pg" && config.currentSchema) {
      await config.execQuery!(`SET search_path = ${config.currentSchema}`);
    }
    return config.execQuery!(query);
  }

  async runSqlScript(sqlScript: string): Promise<void> {
    const { config } = this;
    const { execSqlScript } = config;
    if (execSqlScript) {
      return await config.execSqlScript!(sqlScript);
    }
    /* ignore result */ await this.runQuery(sqlScript);
  }

  async hasVersionTable(): Promise<boolean> {
    const sql = this.getColumnsSql();
    const results = await this.runQuery(sql);
    const { rows } = results;
    return rows.length > 0;
  }

  async ensureTable(): Promise<void> {
    const { config } = this;
    const sql = this.getColumnsSql();
    const results = await this.runQuery(sql);

    const { rows } = results;
    const sqls: string[] = [];

    if (rows.length === 0) {
      let type = "BIGINT";
      if (config.driver === "pg") {
        // When using pg, create a schema if schemaTable has a `.` in it
        const schema = config.schemaTable.split(".");
        if (schema[1]) {
          sqls.push(`CREATE SCHEMA IF NOT EXISTS "${schema[0]}";`);
        }
      } else if (config.driver === "sqlite3") {
        type = "INTEGER";
      }

      sqls.push(`
          CREATE TABLE ${this.quotedSchemaTable()} (
            version ${type} PRIMARY KEY
          ); 
        `);
      sqls.push(`
          INSERT INTO ${this.quotedSchemaTable()} (version) 
            VALUES (0);
        `);
    }
    if (!hasColumnName(rows, "name")) {
      sqls.push(this.getAddNameSql());
    }
    if (!hasColumnName(rows, "md5")) {
      sqls.push(this.getAddMd5Sql());
    }
    if (!hasColumnName(rows, "run_at")) {
      sqls.push(this.getAddRunAtSql());
    }

    for (const sql of sqls) {
      await this.runQuery(sql);
    }
  }
}

export default Client;
