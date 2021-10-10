const pg = require("pg");
const Postgrator = require("../../postgrator");
const mssql = require("mssql");
const mysql = require("mysql");

async function getPostgratorEnd(config) {
  if (config.driver === "pg") {
    const client = new pg.Client({
      host: "localhost",
      port: 5432,
      database: "postgrator",
      user: "postgrator",
      password: "postgrator",
    });

    await client.connect();

    const execQuery = (query) => client.query(query);
    const end = () => client.end();

    const postgrator = new Postgrator({
      ...config,
      execQuery,
    });

    return {
      postgrator,
      end,
    };
  }

  if (config.driver === "mssql") {
    const client = new mssql.ConnectionPool({
      server: "localhost",
      database: "master",
      user: "sa",
      password: "Postgrator123!",
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
    });

    await client.connect();

    const postgrator = new Postgrator({
      ...config,
      execQuery: (query) => {
        return new Promise((resolve, reject) => {
          const request = new mssql.Request(client);
          // supporting GO is a BAD IDEA.
          // A failure with GO statements will leave DB in half-migrated state.
          // TODO remove this in next major version
          const batches = query.split(/^\s*GO\s*$/im);

          function runBatch(batchIndex) {
            request.batch(batches[batchIndex], (err, result) => {
              if (err) {
                return reject(err);
              }
              if (batchIndex === batches.length - 1) {
                return resolve({
                  rows: result && result.recordset ? result.recordset : result,
                });
              }
              return runBatch(batchIndex + 1);
            });
          }

          runBatch(0);
        });
      },
    });

    return {
      postgrator,
      end: () => client.close(),
    };
  }

  if (config.driver === "mysql") {
    const connection = mysql.createConnection({
      multipleStatements: true,
      host: "localhost",
      database: "postgrator",
      user: "postgrator",
      password: "postgrator",
    });

    await new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    const postgrator = new Postgrator({
      ...config,
      execQuery: (query) => {
        return new Promise((resolve, reject) => {
          connection.query(query, (err, rows, fields) => {
            if (err) {
              return reject(err);
            }
            const results = { rows, fields };
            resolve(results);
          });
        });
      },
    });

    return {
      postgrator,
      end: () =>
        new Promise((resolve, reject) => {
          connection.end((err) => {
            if (err) {
              return reject(err);
            }
            resolve();
          });
        }),
    };
  }
}

module.exports = {
  getPostgratorEnd,
};
