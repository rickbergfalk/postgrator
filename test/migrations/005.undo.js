/*
  using this to demo that you use environment variables to generate sql
 */
process.env.TEST_NAME = 'aesthete';

module.exports.generateSql = function () {
  return "DELETE FROM person where name = '"+process.env.TEST_NAME+"'";
};