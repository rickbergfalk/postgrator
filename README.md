# Postgrator

[![CircleCI](https://circleci.com/gh/rickbergfalk/postgrator.svg?style=svg)](https://circleci.com/gh/rickbergfalk/postgrator)

A Node.js SQL migration library using a directory of plain SQL scripts. Supports
Postgres, MySQL, and SQL Server.

Available as a cli tool: https://www.npmjs.com/package/postgrator-cli.

## Installation

_As of postgrator 4 Node.js version 10 or greater is required_

```sh
npm install postgrator
# install necessary db engine(s) if not installed yet
npm install pg@8
npm install mysql@2
npm install mysql2@2
npm install mssql@6
```

## Supported DB Drivers

Using a package version other than the below may not work.

- pg 6.x.x
- pg 7.x.x
- pg 8.x.x
- mysql 2.x.x
- mysql2 1.x.x
- mysql2 2.x.x
- mssql 4.x.x
- mssql 5.x.x
- mssql 6.x.x

## Usage

Create a directory and stick some SQL scripts in there that change your database
in some way. It might look like:

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

The files must follow the convention
[version].[action].[optional-description].sql or
[version].[action].[optional-description].js

**Version** must be a number, but you may start and increment the numbers in any
way you'd like. If you choose to use a purely sequential numbering scheme
instead of something based off a timestamp, you will find it helpful to start
with 000s or some large number for file organization purposes.

**Action** must be either "do" or "undo". Do implements the version, and undo
undoes it.

**Optional-description** can be a label or tag to help keep track of what
happens inside the script. Descriptions should not contain periods.

**SQL or JS** You have a choice of either using a plain SQL file or you can also
generate your SQL via a javascript module. The javascript module should export a
function called generateSql() that returns back a string representing the SQL.
For example:

```js
module.exports.generateSql = function () {
  return (
    "CREATE USER transaction_user WITH PASSWORD '" +
    process.env.TRANSACTION_USER_PASSWORD +
    "'"
  )
}
```

You might want to choose the JS file approach, in order to make use (secret)
environment variables such as the above.

Support for asynchronous functions is provided, in the event you need to retrieve data from a external source, for example:

```js
const axios = require('axios')

module.exports.generateSql = async () => {
  const response = await axios({
    method: 'get',
    url: 'https://api.example.org/person/1',
  })
  return `INSERT INTO person (name, age) VALUES ('${response.data.name}', ${response.data.age});`
}
```

To run your sql migrations with Postgrator, write a Node.js script or integrate
postgrator with your application.

When first run against your database, Postgrator will create the table specified
by config.schemaTable. Postgrator relies on this table to track what version the
database is at.

Postgrator automatically determines whether it needs to go "up" or "down", and
will update the schemaTable accordingly. If the database is already at the
version specified to migrate to, Postgrator does nothing. 

```js
const Postgrator = require('postgrator')
const pg = require('pg')

async function main() {
  // Create a client of your choice
  const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    database: 'postgrator',
    user: 'postgrator',
    password: 'postgrator',
  })

  try {
    // Establish a database connection
    await client.connect();

    // Create a postgrator instance, with necessary info
    // * Where are migrations scripts located
    // * Which database are we targeting (pg, mysql, or mssql)
    // * What is the name of the database
    // * Optionally, name of table to track versions
    // * A function to execute SQL. Must return Promise<{ rows: [{ column_name: 'column_value' }] }>
    const postgrator = new Postgrator({
      // glob pattern to files.
      migrationPattern: __dirname + '/some/pattern/*',
      // Driver: must be pg, mysql, mysql2 or mssql
      driver: 'pg',
      database: 'databasename',
      // Schema table name. Optional. Default is schemaversion
      schemaTable: 'schemaversion',
      // Function to execute SQL. 
      // MUST return Promise<{ rows: [{ column_name: 'column_value' }] }>
      // If using pg client, the library's query method has a compatible return value.
      execQuery: (query) => client.query(query)
    })

    // Migrate to specific version
    const appliedMigrations = await postgrator.migrate('002');
    console.log(appliedMigrations);

    // Or migrate to max version (optionally can provide 'max')
    await postgrator.migrate();
  } catch (error) {
    // If error happened partially through migrations,
    // error object is decorated with appliedMigrations
    console.error(error.appliedMigrations) // array of migration objects
  }
  
  // Once done migrating, close your connection.
  await client.end();
}
main();
```

### Options


| option  | required  | description  | default |
|---|---|---|---|
| `migrationPattern` | Required | Glob pattern to migration files. e.g. `path.join(__dirname, '/migrations/*')` |   |
|`driver` | Required | Must be `pg`, `mysql`, `mysql2` or `mssql` |   |
|`database`| Required | Target database name. |  |
|`execQuery`| Required | Function to execute SQL. MUST return a promise containing an object with a rows array of objects. For example `{ rows: [{ column_name: 'column_value' }]}` |  |
|`schemaTable`| Optional | Table created to track schema version. When using Postgres, you may specify schema as well, e.g. `schema_name.table_name`| `schemaversion` |


### Migrating to `execQuery` approach

TODO: link to recipes

If you used the `currentSchema` option with the now deprecated Postgrator-managed connections, you'll need to manage this yourself when switching to using `execQuery`. This can be accomplished by running `SET search_path = ${currentSchema}` prior to executing your SQL. 

### Checksum validation

By default Postgrator will generate an md5 checksum for each migration file, and
save the value to the schema table after a successful migration.

Prior to applying migrations to a database, for any existing migration in the
migration directory already run Postgrator will validate the md5 checksum to
ensure the contents of the script have not changed. If a change is detected,
migration will stop, reporting an error.

Because line endings may differ between environments/editors, an option is
available to force a specific line ending prior to generating the checksum.

```js
const postgrator = new Postgrator({
  validateChecksums: true, // Set to false to skip validation
  newline: 'CRLF', // Force using 'CRLF' (windows) or 'LF' (unix/mac)
})
```

### Migration object

Postgrator will often return a migration object or array of migrations. The
format of a migration object is

```js
{
  version: versionNumber,
  action: 'do',
  name: 'first-table',
  filename: '0001.up.first-table.sql',
  md5: 'checksumvalue',
  getSql: () => {} // sync function to get sql from file
}
```

### Logging

Postgrator is an event emiter, allowing you to log however
you want to log. There are no events for error or finish.

```js
const postgrator = new Postgrator(options)
postgrator.on('validation-started', (migration) => console.log(migration))
postgrator.on('validation-finished', (migration) => console.log(migration))
postgrator.on('migration-started', (migration) => console.log(migration))
postgrator.on('migration-finished', (migration) => console.log(migration))
```

### Migration errors

If `postgrator.migrate()` fails running multiple migrations, Postgrator will
stop running any further migrations. Migrations successfully run prior to the
migration with the error will remain implemented however.

If you need to migration back down to the version the database was at prior to
running migrate(), that is up to you to implement. Instead of doing this
however, consider writing your application in a way that is compatible with any
version of a future release.

In the event of an error during migration, the error object will be decorated
with an array of migrations that run successfully (`error.appliedMIgrations`).

Keep in mind how you write your SQL - You may (or may not) want to write your
SQL defensively (ie, check for pre-existing objects before you create new ones).

### Preventing partial migrations

Depending on your database and database configuration, consider wrapping each
migration in a transaction or BEGIN/END block. By default Postgres and SQL
Server consider multiple statements run in one execution part of one implicit
transaction. MySQL however will implement up to the failure.

If using SQL Server, do not write a migration containing multiple statements
using the `GO` keyword. Instead break statements between the `GO` keyword into
multiple migration files, ensuring that you do not end up with partial
migrations implemented but no record of that happening.

### Utility methods

Some of postgrator's methods may come in useful performing other migration tasks

```js
// Get max version available from filesystem, as number, not string
const maxVersionAvailable = await postgrator.getMaxVersion();
console.log(maxVersionAvailable);

// "current" database schema version as number, not string
const version = await postgrator.getDatabaseVersion();
console.log(version);

// To get all migrations from directory and parse metadata
const migrations = await postgrator.getMigrations();
console.log(migrations);
```

## Tests

A docker-compose file is provided with postgres and mysql (mariadb) containers
configured for the tests. SQL Server tests also exist, but are commented out
since the requirements are quite high to run them.

To run postgrator tests locally, you'll need Docker installed.

```sh
# In one terminal window
docker-compose up
# In another terminal once databases are up
npm test
# After tests, in docker session
# control/command-c to quit docker-compose and remove containers
docker-compose rm --force
```

## License

MIT
