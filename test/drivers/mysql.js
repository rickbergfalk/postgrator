const path = require("path");
const mysql = require("mysql");
const driverExecQuery = require("./driverExecQuery");
const Postgrator = require("../../postgrator");
const { getPostgratorEnd } = require("../test-util");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationDirectory: path.join(__dirname, "../migrations"),
    driver: "mysql",
    database: "postgrator",
  });
}, "mysql: execQuery");
