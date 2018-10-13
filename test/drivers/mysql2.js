const path = require('path')
const testConfig = require('./driverIntegration')

testConfig(
  {
    migrationDirectory: path.join(__dirname, '../migrations'),
    driver: 'mysql2',
    // MySQL 8 is mapped to different port
    // TODO - test code should probably run in container so port mapping is unnecessary
    // and db can be targeted by host alone
    port: 3008,
    host: 'localhost',
    database: 'postgrator',
    username: 'postgrator',
    password: 'postgrator'
  },
  'Driver: mysql2 against MySQL 8'
)
