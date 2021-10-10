const path = require("path");
const mssql = require("mssql");
const driverExecQuery = require("./driverExecQuery");
const Postgrator = require("../../postgrator");
const { getPostgratorEnd } = require("../test-util");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationDirectory: path.join(__dirname, "../migrations"),
    driver: "mssql",
    database: "master",
  });
}, "mssql: execQuery");
