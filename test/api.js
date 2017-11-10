/* global it, describe */
const assert = require('assert')
const postgrator = require('../postgrator')

const path = require('path')
const migrationDirectory = path.join(__dirname, 'migrations')
const pgUrl = 'tcp://postgrator:postgrator@localhost:5432/postgrator'

describe('API', function() {
  postgrator.setConfig({
    driver: 'pg',
    migrationDirectory: migrationDirectory,
    connectionString: pgUrl
  })

  it('Migrates up to 003', function(done) {
    postgrator.migrate('003', function(err, migrations) {
      assert.ifError(err)
      assert.equal(migrations.length, 3, '3 migrations run')
      postgrator.endConnection(done)
    })
  })

  it('Implements getCurrentVersion', function(done) {
    postgrator.getCurrentVersion(function(err, currentVersion) {
      assert.ifError(err)
      console.log(currentVersion)
      postgrator.endConnection(done)
    })
  })

  it('Implements getVersions', function(done) {
    postgrator.getVersions(function(err, versions) {
      assert.ifError(err)
      console.log(versions)
      postgrator.endConnection(done)
    })
  })

  it('Migrates down to 000', function(done) {
    postgrator.migrate('000', function(err, migrations) {
      assert.ifError(err)
      assert.equal(migrations.length, 3, '3 migrations run')
      postgrator.endConnection(done)
    })
  })

  it('Drops the schemaversion table', function(done) {
    postgrator.runQuery('DROP TABLE schemaversion', function(err) {
      assert.ifError(err)
      postgrator.endConnection(done)
    })
  })
})
