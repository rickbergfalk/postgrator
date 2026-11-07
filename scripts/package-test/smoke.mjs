// Runtime smoke test for the packed `postgrator` tarball.
// This intentionally imports the package by name from a throwaway consumer
// project (see scripts/test-package.mjs) so it exercises `dist` and the
// published `exports` map rather than `src`.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import Postgrator from "postgrator";

const migrationsDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "postgrator-smoke-migrations-")
);

try {
  fs.writeFileSync(
    path.join(migrationsDir, "001.do.sql"),
    "CREATE TABLE smoke_test (id INTEGER PRIMARY KEY);"
  );
  fs.writeFileSync(
    path.join(migrationsDir, "001.undo.sql"),
    "DROP TABLE smoke_test;"
  );

  const db = new Database(":memory:");

  const execQuery = async (query) => {
    const statement = db.prepare(query);
    try {
      const rows = statement.reader ? statement.all() : [];
      if (!statement.reader) {
        statement.run();
      }
      return { rows };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("This statement does not return data")
      ) {
        statement.run();
        return { rows: [] };
      }
      throw error;
    }
  };

  const postgrator = new Postgrator({
    driver: "sqlite3",
    migrationPattern: path.join(migrationsDir, "*.sql"),
    execQuery,
    execSqlScript: async (sqlScript) => {
      db.exec(sqlScript);
    },
  });

  // The bare specifier must resolve into the packed package's dist output.
  const resolvedEntry = fileURLToPath(import.meta.resolve("postgrator"));
  assert.match(
    resolvedEntry.replaceAll("\\", "/"),
    /node_modules\/postgrator\/dist\/postgrator\.js$/
  );

  // Public surface: default export is the constructible Postgrator class.
  assert.equal(typeof Postgrator, "function");
  assert.equal(
    postgrator.on("migration-finished", () => {}),
    postgrator
  );

  // Migrations are discovered and read from the filesystem through `dist`.
  const migrations = await postgrator.getMigrations();
  assert.deepEqual(
    migrations.map((migration) => [migration.version, migration.action]),
    [
      [1, "do"],
      [1, "undo"],
    ]
  );
  assert.match(migrations[0].md5, /^[a-f0-9]{32}$/);
  assert.equal(
    await migrations[0].getSql(),
    "CREATE TABLE smoke_test (id INTEGER PRIMARY KEY);"
  );

  // End-to-end migrate + revert against a real database.
  const applied = await postgrator.migrate("1");
  assert.equal(applied.length, 1);
  assert.equal(await postgrator.getDatabaseVersion(), 1);

  const reverted = await postgrator.migrate("0");
  assert.equal(reverted.length, 1);
  assert.equal(await postgrator.getDatabaseVersion(), 0);

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name);
  assert.ok(!tables.includes("smoke_test"));

  db.close();

  // Subpath export stays reachable.
  const { default: packagedPackageJson } = await import(
    "postgrator/package.json",
    { with: { type: "json" } }
  );
  assert.equal(packagedPackageJson.name, "postgrator");

  console.log("packed package smoke test passed");
} finally {
  fs.rmSync(migrationsDir, { recursive: true, force: true });
}
