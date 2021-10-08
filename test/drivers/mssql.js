const path = require('path')
const testConfig = require('./driverIntegration')
const mssql = require('mssql')
const driverExecQuery = require('./driverExecQuery')
const Postgrator = require('../../postgrator')

// SQL Server needs 2 GB of RAM
testConfig({
  migrationDirectory: path.join(__dirname, '../migrations'),
  driver: 'mssql',
  host: 'localhost',
  database: 'master',
  username: 'sa',
  password: 'Postgrator123!',
  options: {
    encrypt: false, // for azure
    trustServerCertificate: true, // change to true for local dev / self-signed certs. defaults to false
  },
})

// Test via the execQuery config
driverExecQuery(async () => {
  const client = new mssql.ConnectionPool({
    server: 'localhost',
    database: 'master',
    user: 'sa',
    password: 'Postgrator123!',
    options: {
      encrypt: false, // for azure
      trustServerCertificate: true, // change to true for local dev / self-signed certs. defaults to false
    },
    requestTimeout: 15000,
    connectionTimeout: 15000,
    pool: {
      max: 1,
      min: 1,
    },
  })

  await client.connect()

  const postgrator = new Postgrator({
    migrationDirectory: path.join(__dirname, '../migrations'),
    driver: 'mssql',
    database: 'master',
    execQuery: (query) => {
      return new Promise((resolve, reject) => {
        const request = new mssql.Request(client)
        // supporting GO is a BAD IDEA.
        // A failure with GO statements will leave DB in half-migrated state.
        // TODO remove this in next major version
        const batches = query.split(/^\s*GO\s*$/im)

        function runBatch(batchIndex) {
          request.batch(batches[batchIndex], (err, result) => {
            if (err) {
              return reject(err)
            }
            if (batchIndex === batches.length - 1) {
              return resolve({
                rows: result && result.recordset ? result.recordset : result,
              })
            }
            return runBatch(batchIndex + 1)
          })
        }

        runBatch(0)
      })
    },
  })

  return {
    postgrator,
    end: () => client.close(),
  }
}, 'mssql: execQuery')
