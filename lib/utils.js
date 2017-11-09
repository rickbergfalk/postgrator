const fs = require('fs')
const crypto = require('crypto')
const newline = require('newline')

function sortMigrationsAsc(a, b) {
  if (a.version < b.version) {
    return -1
  }
  if (a.version > b.version) {
    return 1
  }
  return 0
}

function sortMigrationsDesc(a, b) {
  if (a.version < b.version) {
    return 1
  }
  if (a.version > b.version) {
    return -1
  }
  return 0
}

/**
 * Calculate checksum of file to detect changes to migrations that have already run.
 * @param {string} filename
 * @param {string} lineEnding - newline setting string for newline lib
 */
function fileChecksum(filename, lineEnding) {
  const content = fs.readFileSync(filename, 'utf8')
  return checksum(content, lineEnding)
}

/**
 *
 * @param {string} content - Content to checksum
 * @param {string} lineEnding - newline setting string for newline lib
 */
function checksum(content, lineEnding) {
  if (lineEnding) {
    log(
      `Converting newline from: ${lineEnding.detect(content)} to: ${lineEnding}`
    )
    content = newline.set(content, lineEnding)
  }
  return crypto
    .createHash('md5')
    .update(content, 'utf8')
    .digest('hex')
}

/**
 * Log info message. Errors are always propagated up to user to handle and log or not
 * TODO message should probably be an object of data for status
 * TODO config.log should allow user to provide new function
 * @param {string} message - The message to log
 */
function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`)
}

module.exports = {
  checksum,
  log,
  fileChecksum,
  sortMigrationsAsc,
  sortMigrationsDesc
}
