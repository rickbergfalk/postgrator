/**
 * Supported database drivers.
 */
export type Driver = "mysql" | "mssql" | "pg" | "sqlite3";

/**
 * A migration can either apply ("do") or revert ("undo") a version.
 */
export type MigrationAction = "do" | "undo";

/**
 * A common query result.
 */
export interface QueryResult {
  rows: any[];
  fields?: any;
}

/**
 * A migration object.
 */
export interface Migration {
  version: number;
  action: MigrationAction;
  filename: string;
  name: string;
  md5?: string;
  getSql: () => string | Promise<string>;
}

export type ExecQuery = (query: string) => Promise<QueryResult>;
export type ExecSqlScript = (sqlScript: string) => Promise<void>;

export interface BaseOptions {
  schemaTable?: string;
  validateChecksums?: boolean;
  migrationPattern?: string;
  newline?: string;
  execQuery?: ExecQuery;
  execSqlScript?: ExecSqlScript;
}

/**
 * Configuration options for MySQL connections.
 */
export interface MySQLOptions extends BaseOptions {
  driver: "mysql";
  database?: string;
}

/**
 * Configuration options for PostgreSQL connections.
 */
export interface PostgreSQLOptions extends BaseOptions {
  driver: "pg";
  database?: string;
  currentSchema?: string;
}

/**
 * Configuration options for Microsoft SQL Server connections.
 */
export interface MsSQLOptions extends BaseOptions {
  driver: "mssql";
  database: string;
  currentSchema?: string;
}

/**
 * Configuration options for Sqlite3.
 */
export interface Sqlite3Options extends BaseOptions {
  driver: "sqlite3";
  currentSchema?: string;
}

export type Options =
  PostgreSQLOptions | MySQLOptions | MsSQLOptions | Sqlite3Options;

/**
 * Configuration after Postgrator defaults have been applied.
 */
export interface ResolvedOptions {
  driver: Driver;
  database?: string;
  currentSchema?: string;
  schemaTable: string;
  validateChecksums: boolean;
  migrationPattern?: string;
  newline?: string;
  execQuery?: ExecQuery;
  execSqlScript?: ExecSqlScript;
}

/**
 * An error thrown during migration, decorated with the migrations that
 * completed successfully before the failure.
 */
export interface MigrationError extends Error {
  appliedMigrations: Migration[];
}

/**
 * A migration event handler.
 *
 * @param migration the migration object representing this event
 */
export type MigrationEventCallback = (migration: Migration) => void;
