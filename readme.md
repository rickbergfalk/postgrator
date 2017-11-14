# Postgrator 3

A Node.js SQL migration library using a directory of plain SQL scripts.
Supports Postgres, MySQL, and SQL Server.

Available as a cli tool: https://www.npmjs.com/package/postgrator-cli.

**The docs below are for Postgrator 3, which is still in development. Version 2 docs available at [README.v2.md](README.v2.md).**


## Installation

```sh
npm install postgrator
# install necessary db engine(s) if they are not installed yet
npm install pg
npm install mysql
npm install mssql
```


## Version 3.0 Features & breaking changes (unreleased, in development)

### Features & Improvements
- `run_at` timestamp column added to schema table
- `md5` and `name` columns added for all implementations
- Checksum validation now implemented for all drivers
- Checksum validation may be skipped using config `validateChecksums: false`
- Callback API replaced with Promises
- Connections opened/closed automatically (no more `.endConnection()`)
- Lots of tests

### Breaking changes
- Node 6 or greater now required
- DB drivers must be installed prior to use (`pg`, `mysql`, `mssql`)
- Calling `.migrate()` without input migrates to latest/max
- `pg.js` and `tedious` no longer valid driver config option
- None of the API is the same
- Logging to console removed (and so has config.logProgress)

### TODO 
- [ ] document utility functions


## Usage

Create a directory and stick some SQL scripts in there that change your database in some way. It might look like:

```
migrations/
  |- 001.do.sql
  |- 001.undo.sql
  |- 002.do.optional-description-of-script.sql
  |- 002.undo.optional-description-of-script.sql
  |- 003.do.sql
  |- 003.undo.sql
  |- 004.do.js
  |- 004.undo.js
  |- ... and so on
```

The files must follow the convention [version].[action].[optional-description].sql or  [version].[action].[optional-description].js

**Version** must be a number, but you may start and increment the numbers in any way you'd like.
If you choose to use a purely sequential numbering scheme instead of something based off a timestamp,
you will find it helpful to start with 000s or some large number for file organization purposes.

**Action** must be either "do" or "undo". Do implements the version, and undo undoes it.

**Optional-description** can be a label or tag to help keep track of what happens inside the script. Descriptions should not contain periods.

**SQL or JS**
You have a choice of either using a plain SQL file or you can also generate your SQL via a javascript module. The javascript module should export a function called generateSql() that returns back a string representing the SQL. For example:

```js
module.exports.generateSql = function () {
  return "CREATE USER transaction_user WITH PASSWORD '"+process.env.TRANSACTION_USER_PASSWORD+"'";
};
```

You might want to choose the JS file approach, in order to make use (secret) environment variables such as the above.

To run your sql migrations with Postgrator, write a Node.js script or integrate postgrator with your application in some way:

```js
const Postgrator = require('postgrator');

const postgrator = new Postgrator({
  // Directory containing migration files
  migrationDirectory: __dirname + '/migrations',
  // Driver: must be pg, mysql, or mssql
  driver: 'pg',
  // Database connection config
  host: '127.0.0.1',
  port: 5432,
  database: 'databasename',
  username: 'username',
  password: 'password',
  // Schema table name. Optional. Default is schemaversion
  schemaTable: 'schemaversion'
});

// Migrate to specific version
postgrator.migrate('002')
  .then(appliedMigrations => console.log(appliedMigrations))
  .catch(error => console.log(error));

// Migrate to max version (optionally can provide 'max')
postgrator.migrate()
  .then(appliedMigrations => console.log(appliedMigrations))
  .catch(error => console.log(error));
```


### Checksum validation

By default Postgrator will generate an md5 checksum for each migration file, and save the value to the schema table after a successful migration.

Prior to applying migrations to a database, for any existing migration in the migration directory already run Postgrator will validate the md5 checksum to ensure the contents of the script have not changed. If a change is detected, migration will stop reporting an error.

Because line endings may differ between environments/editors, an option is available to force a specific line ending prior to generating the checksum.

```js
const postgrator = new Postgrator({
  validateChecksums: true, // Set to false to skip validation
  newline: 'CRLF' // Force using 'CRLF' (windows) or 'LF' (unix/mac)
});
```


### Postgres specific notes:

Postgres supports connection string url as well as simple ssl config:

```js
const postgrator = new Postgrator({
  connectionString: 'tcp://username:password@hosturl/databasename',
  ssl: true
});
```


### SQL Server specific notes:

For SQL Server, you may optionally provide an additional options configuration. 
This may be necessary if requiring a secure connection for Azure.

```js
const postgrator = new Postgrator({
  requestTimeout: 1000 * 60 * 60, // Default 1 hour
  options: {
    encrypt: true
  }
});
```

Reference options for mssql for more details: [https://www.npmjs.com/package/mssql](https://www.npmjs.com/package/mssql)


### Utility methods

Some of postgrator's methods may come in useful performing other migration tasks

```js
// To get max version available from filesystem
// version returned as number, not string
postgrator.getMaxVersion()
  .then(version => console.log(version))
  .catch(error => console.error(error))

// "current" database schema version
// version returned as number, not string
postgrator.getDatabaseVersion()
  .then(version => console.log(version))
  .catch(error => console.error(error))

// To get all migrations from directory and parse metadata
postgrator.getMigrations()
  .then(migrations => console.log(migrations))
  .catch(error => console.error(error))

// Run arbitrary SQL query against database
// Connection is established, query is run, then connection is ended
// `results.rows` will be an array of row objects, with column names as keys
// `results` object may have other properties depending on db driver
postgrator.runQuery('SELECT * FROM sometable')
  .then(results => console.log(results))
  .catch(error => console.error(error))
```


## What Postgrator is doing

When first run against your database, *Postgrator will create the table specified by config.schemaTable.* Postgrator relies on this table to track what version the database is at.

Postgrator automatically determines whether it needs to go "up" or "down", and will update the schemaTable accordingly. If the database is already at the version specified to migrate to, Postgrator does nothing.

If a migration fails, Postgrator will stop running any further migrations. It is up to you to migrate back down to the version you started at if you are running several migration scripts. Because of this, keep in mind how you write your SQL - You may (or may not) want to write your SQL defensively (ie, check for pre-existing objects before you create new ones).


## Tests

A docker-compose file is provided with postgres and mysql (mariadb) containers configured for the tests.
To run postgrator tests locally, you'll need Docker installed. To run the tests...

```sh
docker-compose up
npm test
```

## License

MIT
