const path = require("path");
const testUtil = require("../test-util.js");

testUtil.testPgConfig(
  {
    migrationPattern: path.join(__dirname, "../migrations/*"),
    driver: "pg",
    database: "postgrator",
  },
  "Driver: pg"
);

testUtil.testPgConfig(
  {
    migrationPattern: path.join(__dirname, "../migrations/*"),
    driver: "pg",
    database: "postgrator",
    schemaTable: "postgrator.schemaversion",
  },
  "Driver: pg (with schemaTable)"
);

testUtil.testPgConfig(
  {
    migrationPattern: path.join(__dirname, "../migrations/*"),
    driver: "pg",
    database: "postgrator",
    currentSchema: "postgrator",
  },
  "Driver: pg (with currentSchema)"
);
