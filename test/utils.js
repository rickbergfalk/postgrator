/* global it, describe */
const assert = require('assert')
const utils = require('../lib/utils')

describe('getMajorVersion', function() {
  it('Detects db versions', function() {
    assert.strictEqual(utils.getMajorVersion('pg'), 7)
    assert.strictEqual(utils.getMajorVersion('mssql'), 4)
    assert.strictEqual(utils.getMajorVersion('mysql'), 2)
  })

  it('Fails gracefully for uninstalled module', function() {
    const version = utils.getMajorVersion('something')
    assert.strictEqual(version, null)
  })
})
