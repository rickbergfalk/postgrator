const path = require('path')
const testConfig = require('./driverIntegration')
const pg = require('pg')
const driverExecQuery = require('./driverExecQuery')
const Postgrator = require('../../postgrator')

testConfig({
  migrationDirectory: path.join(__dirname, '../migrations'),
  driver: 'pg',
  host: 'localhost',
  port: 5432,
  database: 'postgrator',
  username: 'postgrator',
  password: 'postgrator',
})

testConfig(
  {
    migrationDirectory: path.join(__dirname, '../migrations'),
    driver: 'pg',
    host: 'localhost',
    port: 5432,
    database: 'postgrator',
    username: 'postgrator',
    password: 'postgrator',
    schemaTable: 'postgrator.schemaversion',
  },
  'Driver: pg (with schemaTable)'
)

testConfig(
  {
    migrationDirectory: path.join(__dirname, '../migrations'),
    driver: 'pg',
    host: 'localhost',
    port: 5432,
    database: 'postgrator',
    username: 'postgrator',
    password: 'postgrator',
    currentSchema: 'postgrator',
  },
  'Driver: pg (with currentSchema)'
)

// Test via the execQuery config
driverExecQuery(async () => {
  const currentSchema = 'postgrator'

  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    database: 'postgrator',
    user: 'postgrator',
    password: 'postgrator',
  })

  await client.connect()

  if (currentSchema) {
    await client.query(`SET search_path = ${currentSchema}`)
  }

  const postgrator = new Postgrator({
    migrationDirectory: path.join(__dirname, '../migrations'),
    driver: 'pg',
    database: 'postgrator',
    execQuery: (query) => client.query(query),
  })

  return {
    postgrator,
    end: () => client.end(),
  }
}, 'pg: execQuery')
