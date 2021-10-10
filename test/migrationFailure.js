const assert = require("assert");
const path = require("path");
const { getPostgratorEnd } = require("./test-util");
const migrationDirectory = path.join(__dirname, "failMigrations");

testConfig(() => {
  return getPostgratorEnd({
    migrationDirectory: migrationDirectory,
    driver: "pg",
    database: "postgrator",
  });
}, "pg");

testConfig(() => {
  return getPostgratorEnd({
    migrationDirectory: migrationDirectory,
    driver: "mysql",
    database: "postgrator",
  });
}, "mysql");

testConfig(() => {
  return getPostgratorEnd({
    migrationDirectory: migrationDirectory,
    driver: "mssql",
    database: "master",
  });
}, "mssql");

function testConfig(factoryFunction, driver) {
  describe(`migrationFailure: ${driver}`, function () {
    let postgrator;
    let end = () => {};

    before(async () => {
      const result = await factoryFunction();
      postgrator = result.postgrator;
      end = result.end;
    });

    it("Handles failed migrations", function () {
      return postgrator.migrate().catch((error) => {
        assert(error, "Error expected from bad migration");
        assert(
          error.appliedMigrations,
          "appliedMigrations decorated on error object"
        );
      });
    });

    it("Does not implement partial migrations", function () {
      return postgrator.runQuery("SELECT name FROM widgets").then((results) => {
        assert(results.rows);
        assert.strictEqual(results.rows.length, 0, "Table should be empty");
      });
    });

    it("Migrates down to 000", function () {
      return postgrator.migrate("00");
    });

    after(async function () {
      await postgrator.runQuery("DROP TABLE schemaversion");
      await end();
    });
  });
}
