import assert from "assert";
import pg from "pg";
import Postgrator from "../postgrator.js";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrationPattern = path.join(__dirname, "migrations/*");

describe("API", function () {
  const client = new pg.Client({
    host: "localhost",
    port: 5432,
    database: "postgrator",
    user: "postgrator",
    password: "postgrator",
  });

  const postgrator = new Postgrator({
    driver: "pg",
    migrationPattern,
    // database: "postgrator",
    execQuery: (query) => client.query(query),
  });

  const vStarted = [];
  const vFinished = [];
  const mStarted = [];
  const mFinished = [];
  postgrator.on("validation-started", (migration) => vStarted.push(migration));
  postgrator.on("validation-finished", (migration) =>
    vFinished.push(migration)
  );
  postgrator.on("migration-started", (migration) => mStarted.push(migration));
  postgrator.on("migration-finished", (migration) => mFinished.push(migration));

  before(async () => {
    await client.connect();
  });

  it("Migrates up to 003", function () {
    return postgrator.migrate("003").then((migrations) => {
      assert.strictEqual(migrations.length, 3, "3 migrations run");
    });
  });

  it("Emits migration events", function () {
    assert.strictEqual(mStarted.length, 3);
    assert.strictEqual(mFinished.length, 3);
  });

  it("Emits validation events", function () {
    return postgrator.migrate("004").then(() => {
      assert.strictEqual(vStarted.length, 3);
      assert.strictEqual(vFinished.length, 3);
    });
  });

  it("Implements getDatabaseVersion", function () {
    return postgrator.getDatabaseVersion().then((version) => {
      assert.strictEqual(version, 4);
    });
  });

  it("Implements getMigrations", function () {
    return postgrator.getMigrations().then((migrations) => {
      assert.strictEqual(migrations.length, 12);
      const m = migrations[0];
      assert.strictEqual(m.version, 1);
      assert.strictEqual(m.action, "do");
      assert(m.filename.endsWith("001.do.sql"));
      assert.strictEqual(m.name, "");
      // eslint-disable-next-line no-prototype-builtins
      assert(m.hasOwnProperty("name"));

      const m2 = migrations.find((m) => m.version === 2 && m.action === "do");
      assert.strictEqual(m2.name, "some-description");
    });
  });

  it("Finds migrations by glob pattern", function () {
    const patterngrator = new Postgrator({
      driver: "pg",
      migrationPattern: path.join(__dirname, "/fail*/*"),
    });
    return patterngrator.getMigrations().then((migrationsByPattern) => {
      assert.strictEqual(migrationsByPattern.length, 4);
    });
  });

  it("Implements getMaxVersion", function () {
    return postgrator.getMaxVersion().then((max) => {
      assert.strictEqual(max, 6);
    });
  });

  it("Migrates down to 000", function () {
    return postgrator.migrate("000").then((migrations) => {
      assert.strictEqual(migrations.length, 4, "4 migrations run");
    });
  });

  after(async () => {
    await postgrator.runQuery("DROP TABLE schemaversion");
    await client.end();
  });
});
