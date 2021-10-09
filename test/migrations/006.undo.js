module.exports.generateSql = function () {
  return (
    "DELETE FROM person where name = '" + process.env.TEST_ANOTHER_NAME + "'"
  );
};
