const path = require('path')
const testConfig = require('./driverIntegration')

testConfig(
  {
    migrationDirectory: path.join(__dirname, '../migrations'),
    driver: 'mysql',
    port: 3306,
    host: 'localhost',
    database: 'postgrator',
    username: 'postgrator',
    password: 'postgrator'
  },
  'Driver: mysql against MariaDB'
)
