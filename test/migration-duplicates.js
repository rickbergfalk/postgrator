const assert = require("assert");
const Postgrator = require("../postgrator");

const path = require("path");
const migrationDirectory = path.join(__dirname, "duplicateMigrations");

testDuplicateMigrations({
  migrationDirectory: migrationDirectory,
  driver: "pg",
  host: "localhost",
  port: 5432,
  database: "postgrator",
  username: "postgrator",
  password: "postgrator",
});

testDuplicateMigrations({
  migrationDirectory: migrationDirectory,
  driver: "mysql",
  host: "localhost",
  database: "postgrator",
  username: "postgrator",
  password: "postgrator",
});

testDuplicateMigrations({
  migrationDirectory: migrationDirectory,
  driver: "mssql",
  host: "localhost",
  database: "master",
  username: "sa",
  password: "Postgrator123!",
  options: {
    encrypt: false, // for azure
    trustServerCertificate: true, // change to true for local dev / self-signed certs. defaults to false
  },
});

function testDuplicateMigrations(config) {
  describe(`Driver: ${config.driver}`, function () {
    const postgrator = new Postgrator(config);

    it("Refuses to run if there are duplicate migrations", async function () {
      await assert.rejects(
        () => postgrator.migrate(),
        "Error expected from duplicated migrations"
      );
    });
  });
}
