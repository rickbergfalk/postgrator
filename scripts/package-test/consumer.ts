// Type-level consumer for the packed `postgrator` tarball.
// Compiled by scripts/test-package.mjs with `skipLibCheck: false` so the
// published `.d.ts` files are type-checked as a consumer would see them.
import Postgrator, {
  type Driver,
  type ExecQuery,
  type ExecSqlScript,
  type Migration,
  type MigrationAction,
  type Options,
  type QueryResult,
  type ResolvedOptions,
} from "postgrator";

const execQuery: ExecQuery = async (query: string): Promise<QueryResult> => {
  return { rows: [query] };
};

const execSqlScript: ExecSqlScript = async (sqlScript: string) => {
  void sqlScript;
};

const options: Postgrator.Options = {
  driver: "sqlite3",
  migrationPattern: "migrations/*.sql",
  execQuery,
  execSqlScript,
};

const postgrator = new Postgrator(options);

// `on()` is typed to return `this`.
const chained: Postgrator = postgrator.on(
  "migration-started",
  (migration: Migration) => {
    const version: number = migration.version;
    void version;
  }
);
void chained;

const runnable: Postgrator.Migration[] = postgrator.getRunnableMigrations(0, 1);
void runnable;

const migrations: Promise<Migration[]> = postgrator.getMigrations();
void migrations;

const config: ResolvedOptions = postgrator.config;
const migration: Migration = {
  version: 1,
  action: "do",
  filename: "001.do.sql",
  name: "",
  getSql: () => "SELECT 1",
};
const optionalChecksum: string | undefined = migration.md5;
void optionalChecksum;

const action: MigrationAction = migration.action;
void action;

const driver: Driver = options.driver;
void driver;

// Discriminated union narrowing still works for consumers.
function describeOptions(value: Options): string {
  switch (value.driver) {
    case "pg":
      return value.database ?? "default";
    case "mysql":
    case "mssql":
      return value.database;
    case "sqlite3":
      return "sqlite3";
  }
}

void describeOptions(options);
void config;

// Namespace aliases are usable from the published declarations.
const namespacedOptions: Postgrator.Options = options;
const namespacedMigration: Postgrator.Migration = migration;
void namespacedOptions;
void namespacedMigration;
