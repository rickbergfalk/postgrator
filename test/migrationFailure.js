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
// testConfig({
//   migrationDirectory: migrationDirectory,
//   driver: 'mssql',
//   host: 'localhost',
//   database: 'master',
//   username: 'sa',
//   password: 'Postgrator123!'
// })

function testConfig(config) {
  describe(`Driver: ${config.driver}`, function() {
    const postgrator = new Postgrator(config)

    it('Handles failed migrations', function() {
      return postgrator.migrate().catch(error => {
        assert(error, 'Error expected from bad migration')
        assert(
          error.appliedMigrations,
          'appliedMigrations decorated on error object'
        )
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
