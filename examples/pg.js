const pg = require("pg");
const Postgrator = require("../postgrator");

async function doMigration() {
  const client = new pg.Client({
    host: "localhost",
    port: 5432,
    database: "postgrator",
    user: "postgrator",
    password: "postgrator",
  });

  await client.connect();

  // `pg` package was the reference for postgrator's original common client
  // So there isn't much to do for Postgres.
  const execQuery = (query) => client.query(query);

  const postgrator = new Postgrator({
    /* Add your postgrator config here, path to migrations, etc */
    execQuery,
  });

  // Migrate to latest or whatever version you want
  await postgrator.migrate();

  // close the db connectin
  await client.end();
}
doMigration();
