# Postgrator

A Node.js SQL migration tool using a directory of plain SQL scripts.
Supports Postgres, MySQL, and SQL Server.



## Usage

Create a folder and stick some SQL scripts in there that change your database in some way. It might look like:

```
migrations/
  |- 001.do.sql
  |- 001.undo.sql
  |- 002.do.optional-description-of-script.sql
  |- 002.undo.optional-description-of-script.sql
  |- 003.do.sql
  |- 003.undo.sql
  |- ... and so on
```

The files must follow the convention [version].[action].[optional-description].sql.

**Version** must be a number, but you may start and increment the numbers in any way you'd like.
If you choose to use a purely sequential numbering scheme instead of something based off a timestamp,
you will find it helpful to start with 000s or some large number for file organization purposes.

**Action** must be either "do" or "undo". Do implements the version, and undo undoes it.

**Optional-description** can be a label or tag to help keep track of what happens inside the script. Descriptions should not contain periods.

To run your sql migrations with Postgrator, write a Node.js script or integrate postgrator with your application in some way:

```js
var postgrator = require('postgrator');

postgrator.setConfig({
    migrationDirectory: __dirname + '/migrations',
    schemaTable: 'schemaversion', // optional. default is 'schemaversion'
    driver: 'pg', // or mysql, mssql
    host: '127.0.0.1',
    port: 5432, // optionally provide port
    database: 'databasename',
    username: 'username',
    password: 'password'
});

postgrator.migrate('002', function (err, migrations) {
	if (err) {
        console.log(err)
    } else {
        console.log(migrations)
    }
    postgrator.endConnection(function () {
        // connection is closed, or will close in the case of SQL Server
    });
});
```


### Postgres specific notes:

Alternatively, for Postgres you may provide a connection string containing the database and authentication details:

```js
postgrator.setConfig({
    migrationDirectory: __dirname + '/migrations',
    driver: 'pg',
    connectionString: 'tcp://username:password@hosturl/databasename'
});
```

Postgres also supports simple ssl config
```js
postgrator.setConfig({
    migrationDirectory: __dirname + '/migrations',
    driver: 'pg',
    ssl: true,
    // rest of postgres config
});
```

### SQL Server specific notes:

For SQL Server, you may optionally provide an additional options configuration. This may be necessary if requiring a secure connection for Azure.

```js
postgrator.setConfig({
    migrationDirectory: __dirname + '/migrations',
    schemaTable: 'schemaversion', // optional. default is 'schemaversion'
    driver: 'mssql', 
    host: '127.0.0.1',
    database: 'databasename',
    username: 'username',
    password: 'password',
    requestTimeout: 1000 * 60 * 60, //optional. default is one hour
    options: {
        encrypt: true
    }
});

```

Reference options for mssql for more details: [https://www.npmjs.com/package/mssql](https://www.npmjs.com/package/mssql)



## Version 2.0 Notes

Despite the major version bump, postgrator's API has not changed. Some of its behavior has however:

- Migrating against a Postgres database now logs script checksums. Future migrations will confirm the checksum to ensure any previously run scripts have not been changed. This is a Postgres-only feature for now.
- Postgrator can always migrate to the latest version available by running ```postgrator.migrate('max', callback);```



## What Postgrator is doing

When first run against your database, *Postgrator will create the table specified by config.schemaTable.* Postgrator relies on this table to track what version the database is at.

Postgrator automatically determines whether it needs to go "up" or "down", and will update the schemaTable accordingly. If the database is already at the version specified to migrate to, Postgrator does nothing.

If a migration fails, Postgrator will stop running any further migrations. It is up to you to migrate back down to the version you started at if you are running several migration scripts. Because of this, keep in mind how you write your SQL - You may (or may not) want to write your SQL defensively (ie, check for pre-existing objects before you create new ones).



## Cross platform line feeds

Line feeds: Unix/Mac uses LF, Windows uses 'CRLF', this causes problems for postgrator when calculating the md5 checksum of the migration files - particularly if some developers are on windows, some are on mac, etc. To negate this, you can use the `newline` config flag to tell postgrator to always use a particular line feed, e.g.

```
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



## Installation

```js
npm install postgrator
```


## Tests
To run postgrator tests locally, you'll need:
- A `postgreSQL` instance running on default port (5432), with a `postgrator` (password `postgrator`) account and a `postgrator` database.
- A `MySQL` instance running on default port (3306), with a `root` (password `root`) account and a `test` database
- Optionally a `SQL Server` instance running on default port (1433), with a `testuser` (password `testuser`) account and a `Utility` database (SQL Server tests are commented out)

If you have docker installed you can run the following containers

```sh
docker run --name postgratorpg -p 5432:5432 -e POSTGRES_USER=postgrator -e POSTGRES_PASSWORD=postgrator -d postgres
docker run --name postgratormysql -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=test -d mysql
# mssql docker needs lots of ram and an initial script or something :(
# docker run --name postgratormssql -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=testuser' -p 1433:1433 -d microsoft/mssql-server-linux
```

Then run `npm test`. To remove the images after you're done you can run the following commands, 
though this won't remove the postges/mysql images cached.

```sh
docker rm postgratorpg
docker rm postgratormysql
```

## License

MIT
