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
    content = newline.set(content, lineEnding)
  }
  return crypto
    .createHash('md5')
    .update(content, 'utf8')
    .digest('hex')
}

/**
 * Returns major version of installed package relative to this project
 * @param {string} packageName
 */
function getMajorVersion(packageName) {
  let majorVersion, path

  // If module is not installed this throws error
  try {
    path = require.resolve(packageName)
  } catch (error) {
    return null
  }

  const parts = path.split('/')

  while (parts.length && !majorVersion) {
    parts.pop()
    const checkPath = parts.join('/') + '/package.json'
    if (fs.existsSync(checkPath)) {
      const pkg = require(checkPath)
      if (pkg.name === packageName) {
        majorVersion = require(checkPath).version.split('.')[0]
      }
    }
  }

  return parseInt(majorVersion)
}

module.exports = {
  checksum,
  fileChecksum,
  getMajorVersion,
  sortMigrationsAsc,
  sortMigrationsDesc
}
