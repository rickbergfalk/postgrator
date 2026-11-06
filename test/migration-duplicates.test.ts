import assert from "assert";
import Postgrator from "../src/postgrator.js";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { describe, it } from "node:test";
import type { Options } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const migrationPattern = path.join(__dirname, "duplicateMigrations/*");

const execQuery = async () => ({ rows: [] });

testDuplicateMigrations({
  migrationPattern,
  driver: "pg",
  database: "postgrator",
  execQuery,
});

testDuplicateMigrations({
  migrationPattern,
  driver: "mysql",
  database: "postgrator",
  execQuery,
});

testDuplicateMigrations({
  migrationPattern,
  driver: "mssql",
  database: "master",
  execQuery,
});

function testDuplicateMigrations(config: Options) {
  describe(`Duplicate migrations: ${config.driver}`, function () {
    const postgrator = new Postgrator(config);

    it("Refuses to run if there are duplicate migrations", async function () {
      await assert.rejects(
        () => postgrator.migrate(),
        "Error expected from duplicated migrations"
      );
    });
  });
}
