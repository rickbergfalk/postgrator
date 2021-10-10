const pg = require("pg");
const driverExecQuery = require("./drivers/driverExecQuery");
const Postgrator = require("../../postgrator");

exports.testPgConfig = function testPgConfig(config, label) {
  driverExecQuery(async () => {
    const client = new pg.Client({
      host: "localhost",
      port: 5432,
      database: "postgrator",
      user: "postgrator",
      password: "postgrator",
    });

    await client.connect();

    const execQuery = (query) => client.query(query);
    const end = () => client.end();

    const postgrator = new Postgrator({
      ...config,
      execQuery,
    });

    return {
      postgrator,
      end,
    };
  }, label);
};
