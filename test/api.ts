import * as assert from "assert";
import * as Postgrator from "../";

import * as path from "path";
const migrationDirectory = path.join(__dirname, "migrations");
const pgUrl = "tcp://postgrator:postgrator@localhost:5432/postgrator";

describe("TypeScript:API", function () {
  const postgrator = new Postgrator({
    driver: "pg",
    migrationDirectory: migrationDirectory,
    connectionString: pgUrl,
  });

  const vStarted: Postgrator.Migration[] = [];
  const vFinished: Postgrator.Migration[] = [];
  const mStarted: Postgrator.Migration[] = [];
  const mFinished: Postgrator.Migration[] = [];
  postgrator.on("validation-started", (migration) => vStarted.push(migration));
  postgrator.on("validation-finished", (migration) =>
    vFinished.push(migration)
  );
  postgrator.on("migration-started", (migration) => mStarted.push(migration));
  postgrator.on("migration-finished", (migration) => mFinished.push(migration));

  it("Migrates up to 003", async () => {
    const migrations: Postgrator.Migration[] = await postgrator.migrate("003");
    assert.strictEqual(migrations.length, 3, "3 migrations run");
  });

  it("Emits migration events", () => {
    assert.strictEqual(mStarted.length, 3);
    assert.strictEqual(mFinished.length, 3);
  });

  it("Emits validation events", async () => {
    const migrations: Postgrator.Migration[] = await postgrator.migrate("004");
    assert.strictEqual(vStarted.length, 3);
    assert.strictEqual(vFinished.length, 3);
  });

  it("Implements getDatabaseVersion", async () => {
    const version: number = await postgrator.getDatabaseVersion();
    assert.strictEqual(version, 4);
  });

  it("Implements getMigrations", async () => {
    const migrations: Postgrator.Migration[] = await postgrator.getMigrations();
    assert.strictEqual(migrations.length, 12);
    const m = migrations[0];
    assert.strictEqual(m.version, 1);
    assert.strictEqual(m.action, "do");
    assert.strictEqual(m.filename, "001.do.sql");
    assert(m.hasOwnProperty("name"));
  });

  it("Finds migrations by glob pattern", async () => {
    const patterngrator = new Postgrator({
      driver: "pg",
      migrationPattern: `${__dirname}/fail*/*`,
      connectionString: pgUrl,
    });
    const migrationsByPattern: Postgrator.Migration[] =
      await patterngrator.getMigrations();
    assert.strictEqual(migrationsByPattern.length, 4);
  });

  it("Implements getMaxVersion", async () => {
    const max: number = await postgrator.getMaxVersion();
    assert.strictEqual(max, 6);
  });

  it("Migrates down to 000", async () => {
    const migrations: Postgrator.Migration[] = await postgrator.migrate("000");
    assert.strictEqual(migrations.length, 4, "4 migrations run");
  });

  after((): Promise<Postgrator.QueryResult> => {
    return postgrator.runQuery("DROP TABLE schemaversion");
  });
});
