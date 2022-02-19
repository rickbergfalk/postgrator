import mssql from "mssql";
import Postgrator from "../postgrator";

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
    migrationPattern: "glob/path/to/migrations/*",
    driver: "mssql",
    database: "database_name",
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
