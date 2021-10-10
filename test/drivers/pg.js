const path = require("path");
const { getPostgratorEnd } = require("../test-util.js");
const driverExecQuery = require("./driverExecQuery");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern: path.join(__dirname, "../migrations/*"),
    driver: "pg",
    database: "postgrator",
  });
}, "Driver: pg");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern: path.join(__dirname, "../migrations/*"),
    driver: "pg",
    database: "postgrator",
    schemaTable: "postgrator.schemaversion",
  });
}, "Driver: pg (with schemaTable)");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern: path.join(__dirname, "../migrations/*"),
    driver: "pg",
    database: "postgrator",
    currentSchema: "postgrator",
  });
}, "Driver: pg (with currentSchema)");
