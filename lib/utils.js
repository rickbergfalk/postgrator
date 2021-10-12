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

function convertLineEnding(content, lineEnding) {
  const lineEndingMap = {
    LF: "\n",
    CR: "\r",
    CRLF: "\r\n",
  };
  if (!lineEndingMap[lineEnding]) {
    throw new Error(
      `newline must be one of: ${Object.keys(lineEndingMap).join(", ")}`
    );
  }
  return content.replace(/\r\n|\r|\n/g, lineEndingMap[lineEnding]);
}

module.exports = {
  fileChecksum,
  sortMigrationsAsc,
  sortMigrationsDesc,
  convertLineEnding,
};
