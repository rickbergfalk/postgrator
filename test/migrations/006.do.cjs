const { promisify } = require("util");

const sleep = promisify(setTimeout);

module.exports.generateSql = async () => {
  await sleep(50);
  return (
    "INSERT INTO person (name, age) VALUES ('" +
    process.env.TEST_ANOTHER_NAME +
    "', 21);"
  );
};
