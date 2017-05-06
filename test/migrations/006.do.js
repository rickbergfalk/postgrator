
module.exports.generateSql = function () {
  return "INSERT INTO person (name, age) VALUES ('" + process.env.TEST_ANOTHER_NAME + "', 21);"
}
