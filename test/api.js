/* global after, it, describe */
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

  const vStarted = []
  const vFinished = []
  const mStarted = []
  const mFinished = []
  postgrator.on('validation-started', migration => vStarted.push(migration))
  postgrator.on('validation-finished', migration => vFinished.push(migration))
  postgrator.on('migration-started', migration => mStarted.push(migration))
  postgrator.on('migration-finished', migration => mFinished.push(migration))

  it('Migrates up to 003', function() {
    return postgrator.migrate('003').then(migrations => {
      assert.equal(migrations.length, 3, '3 migrations run')
    })
  })

  it('Emits migration events', function() {
    assert.equal(mStarted.length, 3)
    assert.equal(mFinished.length, 3)
  })

  it('Emits validation events', function() {
    return postgrator.migrate('004').then(migrations => {
      assert.equal(vStarted.length, 3)
      assert.equal(vFinished.length, 3)
    })
  })

  it('Implements getDatabaseVersion', function() {
    return postgrator.getDatabaseVersion().then(version => {
      assert.equal(version, 4)
    })
  })

  it('Implements getMigrations', function() {
    return postgrator.getMigrations().then(migrations => {
      assert.equal(migrations.length, 12)
      const m = migrations[0]
      assert.equal(m.version, 1)
      assert.equal(m.action, 'do')
      assert.equal(m.filename, '001.do.sql')
      assert(m.hasOwnProperty('name'))
    })
  })

  it('finds migrations by glob pattern', function() {
    const patterngrator = new Postgrator({
      driver: 'pg',
      migrationPattern: `${__dirname}/fail*/*`,
      connectionString: pgUrl
    })
    patterngrator
      .getMigrations()
      .then(migrationsByPattern => {
        assert.equal(migrationsByPattern.length, 4, '4 migrations run')
      })
      .catch(err => console.log(err))
  })

  it('Implements getMaxVersion', function() {
    return postgrator.getMaxVersion().then(max => {
      assert.equal(max, 6)
    })
  })

  it('Migrates down to 000', function() {
    return postgrator.migrate('000').then(migrations => {
      assert.equal(migrations.length, 4, '4 migrations run')
    })
  })

  after(function() {
    return postgrator.runQuery('DROP TABLE schemaversion')
  })
})
