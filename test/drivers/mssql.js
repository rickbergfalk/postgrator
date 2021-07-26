const path = require('path')
const testConfig = require('./driverIntegration')

// SQL Server needs 2 GB of RAM
testConfig({
  migrationDirectory: path.join(__dirname, '../migrations'),
  driver: 'mssql',
  host: 'localhost',
  database: 'master',
  username: 'sa',
  password: 'Postgrator123!',
  options: {
    encrypt: true, // for azure
    trustServerCertificate: true, // change to true for local dev / self-signed certs. defaults to false
  },
})
