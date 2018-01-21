const path = require('path')
const testConfig = require('./driverIntegration')

testConfig({
  migrationDirectory: path.join(__dirname, '../migrations'),
  driver: 'pg',
  host: 'localhost',
  port: 5432,
  database: 'postgrator',
  username: 'postgrator',
  password: 'postgrator'
})
