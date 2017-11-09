/* global it, describe */
const assert = require('assert')
const postgrator = require('../postgrator')

const path = require('path')
const migrationDirectory = path.join(__dirname, 'migrations')
const pgUrl = 'tcp://postgrator:postgrator@localhost:5432/postgrator'

const config = {
  migrationDirectory: migrationDirectory,
  driver: 'pg',
  host: 'localhost',
  port: 5432,
  database: 'postgrator',
  username: 'postgrator',
  password: 'postgrator',
  logProgress: false
}

describe('Postgres connection string API', function() {
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

  it('Migrates down to 000', function(done) {
    postgrator.migrate('000', function(err, migrations) {
      assert.ifError(err)
      assert.equal(migrations.length, 3, '3 migrations run')
      postgrator.endConnection(done)
    })
  })
})

describe('Config API', function() {
  postgrator.setConfig(config)

  it('Migrates multiple versions up (000 -> 002)', function(done) {
    postgrator.migrate('002', function(err, migrations) {
      assert.ifError(err)
      postgrator.runQuery('SELECT name, age FROM person', function(
        err,
        result
      ) {
        assert.ifError(err)
        assert.equal(
          result.rows.length,
          1,
          'person table should have 1 record at this point'
        )
        postgrator.endConnection(done)
      })
    })
  })

  it('Handles current version', function(done) {
    postgrator.migrate('002', function(err, migrations) {
      if (err) throw err
      postgrator.endConnection(done)
    })
  })

  it('Migrates one version up (002 -> 003', function(done) {
    postgrator.migrate('003', function(err, migrations) {
      assert.ifError(err)
      postgrator.runQuery('SELECT name, age FROM person', function(
        err,
        result
      ) {
        assert.ifError(err)
        assert.equal(
          result.rows.length,
          3,
          'person table should have 3 records at this point'
        )
        postgrator.endConnection(done)
      })
    })
  })

  it('Migrates generated SQL', function(done) {
    // using this to demo that you use environment variables to generate sql
    process.env.TEST_NAME = 'aesthete'

    postgrator.migrate('005', function(err, migrations) {
      assert.ifError(err)
      assert.ifError(err)
      postgrator.runQuery('SELECT name, age FROM person', function(
        err,
        result
      ) {
        assert.ifError(err)
        assert.equal(
          result.rows.length,
          5,
          'person table should have 5 records at this point'
        )
        assert.equal(result.rows[4].name, process.env.TEST_NAME)
        postgrator.endConnection(done)
      })
    })
  })

  it('Checksums generated SQL', function(done) {
    process.env.TEST_ANOTHER_NAME = 'sop'
    postgrator.migrate('006', function(err, migrations) {
      assert.ifError(err)
      assert.ifError(err)
      postgrator.runQuery('SELECT name, age FROM person', function(
        err,
        result
      ) {
        assert.ifError(err)
        assert.equal(
          result.rows.length,
          6,
          'person table should have 6 records at this point'
        )
        assert.equal(result.rows[4].name, process.env.TEST_NAME)
        assert.equal(result.rows[5].name, process.env.TEST_ANOTHER_NAME)
        postgrator.endConnection(done)
      })
    })
  })

  it('Migrates to "max"', function(done) {
    postgrator.migrate('max', function(err, migrations) {
      assert.ifError(err)
      postgrator.runQuery('SELECT name, age FROM person', function(
        err,
        result
      ) {
        assert.ifError(err)
        assert.equal(
          result.rows.length,
          6,
          'person table should have 6 records at this point'
        )
        postgrator.endConnection(done)
      })
    })
  })

  it('Migrates down to 000', function(done) {
    postgrator.migrate('00', function(err, migrations) {
      assert.ifError(err)
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
