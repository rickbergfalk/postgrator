import assert from "assert";
import Postgrator from "../postgrator";
import path from "path";

const migrationPattern = path.join(__dirname, "duplicateMigrations/*");

testDuplicateMigrations({
  migrationPattern,
  driver: "pg",
  database: "postgrator",
});

testDuplicateMigrations({
  migrationPattern,
  driver: "mysql",
  database: "postgrator",
});

testDuplicateMigrations({
  migrationPattern,
  driver: "mssql",
  database: "master",
});

function testDuplicateMigrations(config) {
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
