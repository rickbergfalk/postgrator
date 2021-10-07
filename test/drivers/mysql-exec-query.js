const path = require('path')
const mysql = require('mysql')
const driverExecQuery = require('./driverExecQuery')
const Postgrator = require('../../postgrator')

driverExecQuery(async () => {
  const connection = mysql.createConnection({
    multipleStatements: true,
    host: 'localhost',
    database: 'postgrator',
    user: 'postgrator',
    password: 'postgrator',
  })

  await new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) return reject(err)
      resolve()
    })
  })

  const postgrator = new Postgrator({
    migrationDirectory: path.join(__dirname, '../migrations'),
    driver: 'mysql2',
    database: 'postgrator',
    execQuery: (query) => {
      return new Promise((resolve, reject) => {
        connection.query(query, (err, rows, fields) => {
          if (err) {
            return reject(err)
          }
          const results = { rows, fields }
          resolve(results)
        })
      })
    },
  })

  return {
    postgrator,
    end: () =>
      new Promise((resolve, reject) => {
        connection.end((err) => {
          if (err) {
            return reject(err)
          }
          setTimeout(resolve, 100)
        })
      }),
  }
}, 'exec query mysql')
