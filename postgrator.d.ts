import { ConnectionOptions } from 'tls'

declare namespace Postgrator {

  /**
   * A common query result
   */
  export interface QueryResult {
    rows: any[]
    fields: any
  }

  /**
   * A migration object
   */
  export interface Migration {
    version: number
    action: 'do' | 'undo'
    filename: string
    name: string
    md5: string
    getSql: () => string
  }

  export interface BaseOptions {
    schemaTable?: string
    validateChecksums?: boolean
    migrationDirectory?: string
    migrationPattern?: string
    newline?: string
  }

  /**
   * Configuration options for MySQL connections
   */
  export interface MySQLOptions extends BaseOptions {
    driver: 'mysql' | 'mysql2'
    host?: string
    port?: string | number
    username: string
    password: string
    database?: string
  }

  /**
   * Configuration options for PostgreSQL connections
   */
  export interface PostgreSQLOptions extends BaseOptions {
    driver: 'pg'
    ssl?: boolean | ConnectionOptions
    connectionString?: string
    host?: string
    port?: string | number
    user?: string
    username?: string
    password?: string
    database?: string
    currentSchema?: string
  }

  /**
   * Configuration options for Microsoft SQL Server connections
   */
  export interface MsSQLOptions extends BaseOptions {
    driver: 'mssql'
    ssl?: boolean
    connectionString?: string
    host: string
    port: string | number
    username: string
    password: string
    database: string
    options?: any
    requestTimeout?: number
    connectionTimeout?: number
  }

  type Options = PostgreSQLOptions | MySQLOptions | MsSQLOptions

  /**
   * A migration event handler
   *
   * @param migration the migration object representing this event
   */
  export type MigrationEventCallback = (migration: Postgrator.Migration) => void
}

declare class Postgrator {
  /**
   * Creates an instance of the postgrator class
   * @param options Configuration options
   */
  constructor(options: Postgrator.Options)

  /**
   * Reads all migrations from directory
   *
   * @returns array of migration objects
   */
  getMigrations(): Promise<Postgrator.Migration[]>

  /**
   * Executes sql query using the common client and ends connection afterwards
   *
   * @returns result of query
   * @param query sql query to execute
   */
  runQuery(query: string): Promise<Postgrator.QueryResult>

  /**
   * Gets the database version of the schema from the database.
   * Otherwise 0 if no version has been run
   *
   * @returns database schema version
   */
  getDatabaseVersion(): Promise<number>

  /**
   * Returns an object with max version of migration available
   *
   * @returns
   */
  getMaxVersion(): Promise<number>

  /**
   * Validate md5 checksums for applied migrations
   *
   * @returns
   * @param databaseVersion
   */
  validateMigrations(databaseVersion: number): Promise<undefined>

  /**
   * Runs the migrations in the order to reach target version
   *
   * @returns Array of migration objects to appled to database
   * @param migrations Array of migration objects to apply to database
   */
  runMigrations(migrations?: Postgrator.Migration[]): Promise<Postgrator.Migration[]>

  /**
   * returns an array of relevant migrations based on the target and database version passed.
   * returned array is sorted in the order it needs to be run
   *
   * @returns Sorted array of relevant migration objects
   * @param databaseVersion
   * @param targetVersion
   */
  getRunnableMigrations(databaseVersion: number, targetVersion: number): Postgrator.Migration[]

  /**
   * Main method to move a schema to a particular version.
   * A target must be specified, otherwise nothing is run.
   *
   * @returns
   * @param target version to migrate as string or number (handled as  numbers internally)
   */
  migrate(target?: string): Promise<Postgrator.Migration[]>

  /**
   * Registers an event lister for the `validation-started` event
   *
   * @param event the event name
   * @param cb the callback to handle the event
   */
  on(event: 'validation-started', cb: Postgrator.MigrationEventCallback): void

  /**
   * Registers an event lister for the `validation-finished` event
   *
   * @param event the event name
   * @param cb the callback to handle the event
   */
  on(event: 'validation-finished', cb: Postgrator.MigrationEventCallback): void

  /**
   * Registers an event lister for the `migration-started` event
   *
   * @param event the event name
   * @param cb the callback to handle the event
   */
  on(event: 'migration-started', cb: Postgrator.MigrationEventCallback): void

  /**
   * Registers an event lister for the `migration-finished` event
   *
   * @param event the event name
   * @param cb the callback to handle the event
   */
  on(event: 'migration-finished', cb: Postgrator.MigrationEventCallback): void
}

export = Postgrator
