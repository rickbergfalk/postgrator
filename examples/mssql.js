const mssql = require("mssql");
const Postgrator = require("../postgrator");

async function doMigration() {
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
    /* Add your postgrator config here, path to migrations, etc */
    execQuery: (query) => {
      return new Promise((resolve, reject) => {
        const request = new mssql.Request(client);
        // batch will handle multiple queries
        request.batch(query, (err, result) => {
          if (err) {
            return reject(err);
          }
          return resolve({
            rows: result && result.recordset ? result.recordset : result,
          });
        });
      });
    },
  });

  // Migrate to latest or whatever version you want
  await postgrator.migrate();

  // close the db connectin
  await client.close();
}
doMigration();
