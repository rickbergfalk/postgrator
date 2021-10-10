const path = require("path");
const driverExecQuery = require("./driverExecQuery");
const { getPostgratorEnd } = require("../test-util");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern: path.join(__dirname, "../migrations/*"),
    driver: "mssql",
    database: "master",
  });
}, "mssql: execQuery");
