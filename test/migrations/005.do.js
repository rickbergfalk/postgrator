/*
  using this to demo that you use environment variables to generate sql
 */
process.env.TEST_NAME = 'aesthete';

module.exports.generateSql = function () {
  return "INSERT INTO person (name, age) VALUES ('"+process.env.TEST_NAME+"', 21);"
};