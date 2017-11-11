/* global after, it, describe */
const assert = require('assert')
const Postgrator = require('../postgrator')

const path = require('path')
const migrationDirectory = path.join(__dirname, 'migrations')

testConfig({
  migrationDirectory: migrationDirectory,
  driver: 'pg',
  host: 'localhost',
  port: 5432,
  database: 'postgrator',
  username: 'postgrator',
  password: 'postgrator'
})

testConfig({
  migrationDirectory: migrationDirectory,
  driver: 'mysql',
  host: 'localhost',
  database: 'postgrator',
  username: 'postgrator',
  password: 'postgrator'
})

function testConfig(config) {
  describe(`Driver: ${config.driver}`, function() {
    const postgrator = new Postgrator(config)

    it('Migrates multiple versions up (000 -> 002)', function() {
      return postgrator
        .migrate('002')
        .then(migrations => postgrator.runQuery('SELECT name FROM person'))
        .then(results => {
          assert.equal(results.rows.length, 1)
          return postgrator.endConnection()
        })
    })

    it('Handles current version', function() {
      return postgrator.migrate('002').then(migrations => {
        assert.equal(migrations.length, 0)
        return postgrator.endConnection()
      })
    })

    it('Migrates one version up (002 -> 003', function() {
      return postgrator
        .migrate('003')
        .then(migrations => postgrator.runQuery('SELECT name FROM person'))
        .then(results => {
          assert.equal(results.rows.length, 3)
          return postgrator.endConnection()
        })
    })

    it('Migrates generated SQL', function() {
      // using this to demo that you use environment variables to generate sql
      process.env.TEST_NAME = 'aesthete'
      return postgrator
        .migrate('005')
        .then(migrations => postgrator.runQuery('SELECT name, age FROM person'))
        .then(result => {
          assert.equal(result.rows.length, 5)
          assert.equal(result.rows[4].name, process.env.TEST_NAME)
          return postgrator.endConnection()
        })
    })

    it('Checksums generated SQL', function() {
      process.env.TEST_ANOTHER_NAME = 'sop'
      return postgrator
        .migrate('006')
        .then(migrations => postgrator.runQuery('SELECT name, age FROM person'))
        .then(result => {
          assert.equal(result.rows.length, 6)
          assert.equal(result.rows[4].name, process.env.TEST_NAME)
          assert.equal(result.rows[5].name, process.env.TEST_ANOTHER_NAME)
          return postgrator.endConnection()
        })
    })

    it('Migrates to "max"', function() {
      return postgrator
        .migrate('max')
        .then(migrations => postgrator.runQuery('SELECT name, age FROM person'))
        .then(result => {
          assert.equal(result.rows.length, 6)
          return postgrator.endConnection()
        })
    })

    it('Migrates down to 000', function() {
      return postgrator.migrate('00').then(() => postgrator.endConnection())
    })

    after(function() {
      return postgrator
        .runQuery('DROP TABLE schemaversion')
        .then(() => postgrator.endConnection())
    })
  })
}