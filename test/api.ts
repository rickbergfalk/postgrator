import * as assert from 'assert'
import * as Postgrator from '../'

import * as path from 'path'
const migrationDirectory = path.join(__dirname, 'migrations')
const pgUrl = 'tcp://postgrator:postgrator@localhost:5432/postgrator'

describe('TypeScript:API', function() {
  const postgrator = new Postgrator({
    driver: 'pg',
    migrationDirectory: migrationDirectory,
    connectionString: pgUrl
  })

  const vStarted: Postgrator.Migration[] = []
  const vFinished: Postgrator.Migration[] = []
  const mStarted: Postgrator.Migration[] = []
  const mFinished: Postgrator.Migration[] = []
  postgrator.on('validation-started', migration => vStarted.push(migration))
  postgrator.on('validation-finished', migration => vFinished.push(migration))
  postgrator.on('migration-started', migration => mStarted.push(migration))
  postgrator.on('migration-finished', migration => mFinished.push(migration))

  it('Migrates up to 003', async () => {
    const migrations: Postgrator.Migration[] = await postgrator.migrate('003')
    assert.equal(migrations.length, 3, '3 migrations run')
  })

  it('Emits migration events', () => {
    assert.equal(mStarted.length, 3)
    assert.equal(mFinished.length, 3)
  })

  it('Emits validation events', async () => {
    const migrations: Postgrator.Migration[] = await postgrator.migrate('004')
    assert.equal(vStarted.length, 3)
    assert.equal(vFinished.length, 3)
  })

  it('Implements getDatabaseVersion', async () => {
    const version: number = await postgrator.getDatabaseVersion()
    assert.equal(version, 4)
  })

  it('Implements getMigrations', async () => {
    const migrations: Postgrator.Migration[] = await postgrator.getMigrations()
    assert.equal(migrations.length, 12)
    const m = migrations[0]
    assert.equal(m.version, 1)
    assert.equal(m.action, 'do')
    assert.equal(m.filename, '001.do.sql')
    assert(m.hasOwnProperty('name'))
  })

  it('Finds migrations by glob pattern', async () => {
    const patterngrator = new Postgrator({
      driver: 'pg',
      migrationPattern: `${__dirname}/fail*/*`,
      connectionString: pgUrl
    })
    const migrationsByPattern: Postgrator.Migration[] = await patterngrator.getMigrations()
    assert.equal(migrationsByPattern.length, 4)
  })

  it('Implements getMaxVersion', async () => {
    const max: number = await postgrator.getMaxVersion()
    assert.equal(max, 6)
  })

  it('Migrates down to 000', async () => {
    const migrations: Postgrator.Migration[] = await postgrator.migrate('000')
    assert.equal(migrations.length, 4, '4 migrations run')
  })

  after((): Promise<Postgrator.QueryResult> => {
    return postgrator.runQuery('DROP TABLE schemaversion')
  })
})
