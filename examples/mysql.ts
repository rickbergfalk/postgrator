import mysql from "mysql";
import Postgrator from "../src/postgrator.js";
import type { QueryResult } from "../src/types.js";

async function doMigration() {
  const connection = mysql.createConnection({
    multipleStatements: true,
    host: "localhost",
    database: "postgrator",
    user: "postgrator",
    password: "postgrator",
  });

  await new Promise<void>((resolve, reject) => {
    connection.connect((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });

  const postgrator = new Postgrator({
    migrationPattern: "glob/path/to/migrations/*",
    driver: "mysql",
    database: "database_name",
    execQuery: (query) => {
      return new Promise<QueryResult>((resolve, reject) => {
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

  // Migrate to latest or whatever version you want
  await postgrator.migrate();

  // close the db connectin
  await new Promise<void>((resolve, reject) => {
    connection.end((err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}
void doMigration();
