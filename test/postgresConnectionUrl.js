/* global after, it, describe */
const assert = require('assert')
const Postgrator = require('../postgrator')

const path = require('path')
const migrationDirectory = path.join(__dirname, 'migrations')
const pgUrl = 'tcp://postgrator:postgrator@localhost:5432/postgrator'

describe('Postgres connection url', function () {
  const postgrator = new Postgrator({
    driver: 'pg',
    migrationDirectory: migrationDirectory,
    connectionString: pgUrl,
  })

  it('Migrates up to 003', function () {
    return postgrator.migrate('003').then((migrations) => {
      assert.strictEqual(migrations.length, 3, '3 migrations run')
    })
  })

  it('Migrates down to 000', function () {
    return postgrator.migrate('000').then((migrations) => {
      assert.strictEqual(migrations.length, 3, '3 migrations run')
    })
  })

  after(function () {
    return postgrator.runQuery('DROP TABLE schemaversion')
  })
})
