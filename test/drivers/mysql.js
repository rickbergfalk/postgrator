const path = require("path");
const driverExecQuery = require("./driverExecQuery");
const { getPostgratorEnd } = require("../test-util");

driverExecQuery(() => {
  return getPostgratorEnd({
    migrationPattern: path.join(__dirname, "../migrations/*"),
    driver: "mysql",
    database: "postgrator",
  });
}, "mysql: execQuery");
