/* global after, it, describe */
const assert = require('assert')
const Postgrator = require('../postgrator')

const path = require('path')
const migrationDirectory = path.join(__dirname, 'failMigrations')

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

// SQL Server needs 3.25 GB of RAM
testConfig({
  migrationDirectory: migrationDirectory,
  driver: 'mssql',
  host: 'localhost',
  database: 'master',
  username: 'sa',
  password: 'Postgrator123!'
})

function testConfig(config) {
  describe(`Driver: ${config.driver}`, function() {
    const postgrator = new Postgrator(config)

    let migrations = []
    let error

    it('Handles failed migrations', function() {
      return postgrator
        .migrate()
        .then(m => {
          // postgrator.runQuery('SELECT name FROM person')
          migrations = m
        })
        .catch(e => {
          error = e
        })
        .then(() => {
          assert.equal(migrations.length, 1, 'One migration expected')
          assert(error, 'an error is expected from bad migration')
        })
    })

    it('Does not implement partial migrations', function() {
      return postgrator.runQuery('SELECT name FROM widgets').then(results => {
        assert(results.rows)
        assert.equal(results.rows.length, 0, 'Table should be empty')
      })
    })

    it('Migrates down to 000', function() {
      return postgrator.migrate('00')
    })

    after(function() {
      return postgrator.runQuery('DROP TABLE schemaversion')
    })
  })
}
