/* global it, describe */
const assert = require('assert')
const Postgrator = require('../postgrator')

const path = require('path')
const migrationDirectory = path.join(__dirname, 'migrations')
const pgUrl = 'tcp://postgrator:postgrator@localhost:5432/postgrator'

describe('API', function() {
  const postgrator = new Postgrator({
    driver: 'pg',
    migrationDirectory: migrationDirectory,
    connectionString: pgUrl
  })

  it('Migrates up to 003', function() {
    return postgrator.migrate('003').then(migrations => {
      assert.equal(migrations.length, 3, '3 migrations run')
      return postgrator.endConnection()
    })
  })

  it('Implements getCurrentVersion', function() {
    return postgrator.getCurrentVersion().then(currentVersion => {
      assert.equal(currentVersion, 3)
      return postgrator.endConnection()
    })
  })

  it('Implements getMigrations', function() {
    return postgrator.getMigrations().then(migrations => {
      assert.equal(migrations.length, 11)
      const m = migrations[0]
      assert.equal(m.version, 1)
      assert.equal(m.action, 'do')
      assert.equal(m.filename, '001.do.sql')
      assert(m.hasOwnProperty('name'))
      return postgrator.endConnection()
    })
  })

  it('Implements getMaxVersion', function() {
    return postgrator.getMaxVersion().then(max => {
      assert.equal(max, 6)
      return postgrator.endConnection()
    })
  })

  it('Migrates down to 000', function() {
    return postgrator.migrate('000').then(migrations => {
      assert.equal(migrations.length, 3, '3 migrations run')
      return postgrator.endConnection()
    })
  })

  it('Drops the schemaversion table', function() {
    return postgrator
      .runQuery('DROP TABLE schemaversion')
      .then(() => postgrator.endConnection())
  })
})
