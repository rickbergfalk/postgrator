const MssqlClient = require("./MssqlClient");
const MysqlClient = require("./MysqlClient");
const PostgresClient = require("./PostgresClient");

const DRIVERS = ["pg", "mysql", "mssql"];

module.exports = function createCommonClient(config) {
  const driver = DRIVERS.find((d) => d === config.driver);

  if (!driver) {
    throw new Error(
      `db driver '${config.driver}' not supported. Must one of: '${DRIVERS.join(
        ", "
      )}'`
    );
  }

  if (config.driver === "mysql") {
    return new MysqlClient(config);
  } else if (config.driver === "pg") {
    return new PostgresClient(config);
  } else if (config.driver === "mssql") {
    return new MssqlClient(config);
  }
};
