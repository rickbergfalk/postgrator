const path = require('path')
const testConfig = require('./driverIntegration')

testConfig({
  migrationDirectory: path.join(__dirname, '../migrations'),
  driver: 'mysql2',
  host: 'localhost',
  database: 'postgrator',
  username: 'postgrator',
  password: 'postgrator',
})
