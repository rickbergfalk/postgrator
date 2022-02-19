import pg from "pg";
import Postgrator from "../postgrator";

async function doMigration() {
  const client = new pg.Client({
    host: "localhost",
    port: 5432,
    database: "postgrator",
    user: "postgrator",
    password: "postgrator",
  });

  await client.connect();

  const postgrator = new Postgrator({
    migrationPattern: "glob/path/to/migrations/*",
    driver: "pg",
    database: "database_name",
    // `pg` package was the reference for postgrator's original common client
    // So there isn't much to do for Postgres.
    execQuery: (query) => client.query(query),
  });

  // Migrate to latest or whatever version you want
  await postgrator.migrate();

  // close the db connectin
  await client.end();
}
doMigration();
