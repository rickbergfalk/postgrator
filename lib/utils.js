const fs = require('fs')
const path = require('path')
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
  return crypto.createHash('md5').update(content, 'utf8').digest('hex')
}

/**
 * Returns major version of installed package relative to this project
 * @param {string} packageName
 */
function getMajorVersion(packageName) {
  let majorVersion, packagePath

  // If module is not installed this throws error
  try {
    packagePath = require.resolve(packageName)
  } catch (error) {
    return null
  }

  const parts = packagePath.split(path.sep)
  while (parts.length && !majorVersion) {
    parts.pop()
    const checkPath = path.join(parts.join(path.sep), 'package.json')
    if (fs.existsSync(checkPath)) {
      const pkg = require(checkPath)
      if (pkg.name === packageName) {
        majorVersion = require(checkPath).version.split('.')[0]
      }
    }
  }

  return parseInt(majorVersion)
}

/**
 * Check if schema rows has row for column name
 * Checks field column_name and COLUMN_NAME due to db/driver quirks
 * TODO write test to validate against MySQL 8 once node mysql driver connects to 8
 * @param {array<object>} schemaResultRows
 * @param {string} columnName
 */
function hasColumnName(schemaResultRows, columnName) {
  const row = schemaResultRows.find(
    (row) => row.column_name === columnName || row.COLUMN_NAME === columnName
  )
  return row !== undefined
}

/**
 * Checks installed version of driver and prints warning depending on outcome
 * @param {string} driver
 * @param {number} minMajor
 * @param {number} maxMajor
 */
function supportWarning(driver, minMajor, maxMajor) {
  const installedMajor = getMajorVersion(driver)
  if (installedMajor < minMajor) {
    console.error(
      `Package ${driver} version ${installedMajor}.x.x not supported`
    )
    if (maxMajor && maxMajor !== minMajor) {
      console.error(
        `Install ${driver} version ${minMajor}.x.x - ${maxMajor}.x.x`
      )
    } else {
      console.error(`Install ${driver} version ${minMajor}.x.x`)
    }
  } else if (installedMajor > maxMajor) {
    console.warn(`Package ${driver} version ${installedMajor}.x.x not tested`)
    console.warn(`Please raise issue to support ${driver} > ${maxMajor}.x.x`)
  }
}

module.exports = {
  checksum,
  fileChecksum,
  getMajorVersion,
  hasColumnName,
  sortMigrationsAsc,
  sortMigrationsDesc,
  supportWarning,
}
