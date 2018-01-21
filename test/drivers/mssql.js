const path = require('path')
const testConfig = require('./driverIntegration')

// SQL Server needs 2 GB of RAM
testConfig({
  migrationDirectory: path.join(__dirname, '../migrations'),
  driver: 'mssql',
  host: 'localhost',
  database: 'master',
  username: 'sa',
  password: 'Postgrator123!'
})
