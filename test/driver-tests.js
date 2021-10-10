const path = require("path");
const { getPostgratorEnd } = require("./test-util.js");
const driverExecQuery = require("./driverExecQuery");

const migrationPattern = path.join(__dirname, "./migrations/*");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern,
    driver: "pg",
    database: "postgrator",
  });
}, "Driver: pg");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern,
    driver: "pg",
    database: "postgrator",
    schemaTable: "postgrator.schemaversion",
  });
}, "Driver: pg (with schemaTable)");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern,
    driver: "pg",
    database: "postgrator",
    currentSchema: "postgrator",
  });
}, "Driver: pg (with currentSchema)");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern,
    driver: "mssql",
    database: "master",
  });
}, "Driver: mssql");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern,
    driver: "mysql",
    database: "postgrator",
  });
}, "Driver: mysql");
