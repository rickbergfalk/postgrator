const fs = require("fs");
const crypto = require("crypto");

function sortMigrationsAsc(a, b) {
  if (a.version < b.version) {
    return -1;
  }
  if (a.version > b.version) {
    return 1;
  }
  return 0;
}

function sortMigrationsDesc(a, b) {
  if (a.version < b.version) {
    return 1;
  }
  if (a.version > b.version) {
    return -1;
  }
  return 0;
}

/**
 * Calculate checksum of file to detect changes to migrations that have already run.
 * @param {string} filename
 * @param {string} lineEnding - newline setting string for newline lib
 */
function fileChecksum(filename, lineEnding) {
  const content = fs.readFileSync(filename, "utf8");
  return checksum(content, lineEnding);
}

/**
 *
 * @param {string} content - Content to checksum
 * @param {string} lineEnding - newline setting string for newline lib
 */
function checksum(content, lineEnding) {
  if (lineEnding) {
    content = convertLineEnding(content, lineEnding);
  }
  return crypto.createHash("md5").update(content, "utf8").digest("hex");
}

/**
 * Check if schema rows has row for column name
 * Checks field column_name and COLUMN_NAME due to db/driver quirks
 * @param {array<object>} schemaResultRows
 * @param {string} columnName
 */
function hasColumnName(schemaResultRows, columnName) {
  const row = schemaResultRows.find(
    (row) => row.column_name === columnName || row.COLUMN_NAME === columnName
  );
  return row !== undefined;
}

function convertLineEnding(content, lineEnding) {
  const toMap = {
    LF: "\n",
    CR: "\r",
    CRLF: "\r\n",
  };
  if (!["LF", "CR", "CRLF"].includes(lineEnding)) {
    throw new Error("newline must be LF, CR, or CRLF");
  }
  return content.replace(/\r\n|\r|\n/g, toMap[lineEnding]);
}

module.exports = {
  checksum,
  fileChecksum,
  hasColumnName,
  sortMigrationsAsc,
  sortMigrationsDesc,
  convertLineEnding,
};
