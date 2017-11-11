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


## Version 3.0 Breaking changes (unreleased, in development)

- [x] Node 6 or greater now required
- [x] DB drivers must be installed prior to use (`pg`, `mysql`, `mssql`)
- [x] `pg.js` and `tedious` no longer valid driver config option
- [x] Callback API replaced with promise-based functions
- [x] `.getVersions()` removed in favor of `.getMaxVersion()`, `.getCurrentVersion()`, and `.getMigrations()`
- [x] Logging to console removed (and so has config.logProgress)
- [x] Calling `.migrate()` without input migrates to latest/max

### TODO 
- [x] Use ES6 class
- [ ] Add checksums for mysql, mssql
- [ ] Auto close connection at end of migration
- [ ] Checksum for multiple line endings (remove newline dep)
- [ ] Make checksum optional
- [ ] Add timestamp to migration table


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
  migrationDirectory: __dirname + '/migrations',
  schemaTable: 'schemaversion', // optional. default is 'schemaversion'
  driver: 'pg', // or mysql, mssql
  host: '127.0.0.1',
  port: 5432, // optionally provide port
  database: 'databasename',
  username: 'username',
  password: 'password'
});

// Migrate to version specified, or supply 'max' to go all the way up
postgrator.migrate('002')
  .then(migrations => {
    console.log(migrations);
    // return endConnection(), which also returns a promise
    return postgrator.endConnection();
  })
  .catch(error => console.log(error));
```


### Postgres specific notes:

Postgres supports connection string url as well as simple ssl config:

```js
const postgrator = new Postgrator({
  migrationDirectory: __dirname + '/migrations',
  driver: 'pg',
  connectionString: 'tcp://username:password@hosturl/databasename',
  ssl: true
});
```


### SQL Server specific notes:

For SQL Server, you may optionally provide an additional options configuration. 
This may be necessary if requiring a secure connection for Azure.

```js
const postgrator = new Postgrator({
  migrationDirectory: __dirname + '/migrations',
  schemaTable: 'schemaversion', // optional. default is 'schemaversion'
  driver: 'mssql',
  host: '127.0.0.1',
  database: 'databasename',
  username: 'username',
  password: 'password',
  requestTimeout: 1000 * 60 * 60, // optional. default is one hour
  options: {
    encrypt: true
  }
});
```

Reference options for mssql for more details: [https://www.npmjs.com/package/mssql](https://www.npmjs.com/package/mssql)


## What Postgrator is doing

When first run against your database, *Postgrator will create the table specified by config.schemaTable.* Postgrator relies on this table to track what version the database is at.

Postgrator automatically determines whether it needs to go "up" or "down", and will update the schemaTable accordingly. If the database is already at the version specified to migrate to, Postgrator does nothing.

If a migration fails, Postgrator will stop running any further migrations. It is up to you to migrate back down to the version you started at if you are running several migration scripts. Because of this, keep in mind how you write your SQL - You may (or may not) want to write your SQL defensively (ie, check for pre-existing objects before you create new ones).


## Cross platform line feeds

Line feeds: Unix/Mac uses LF, Windows uses 'CRLF', this causes problems for postgrator when calculating the md5 checksum of the migration files - particularly if some developers are on windows, some are on mac, etc. To negate this, you can use the `newline` config flag to tell postgrator to always use a particular line feed, e.g.

```js
postgrator.setConfig({
  migrationDirectory: __dirname + '/migrations',
  driver: 'pg', // or pg.js, mysql, mssql, tedious
  host: '127.0.0.1',
  database: 'databasename',
  username: 'username',
  password: 'password',
  newline: 'CRLF'
});
```

Under the hood this uses the [newline](www.npmjs.com/package/newline) module for detecting and setting line feeds.


## Tests

A docker-compose file is provided with postgres and mysql (mariadb) containers configured for the tests.
To run postgrator tests locally, you'll need Docker installed. To run the tests...

```sh
docker-compose up
npm test
```

## License

MIT
