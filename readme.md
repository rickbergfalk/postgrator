# Postgrator

A Node.js SQL migration tool using a directory of plain SQL or knex scripts. 
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
  |- 004.knex.optional-description-of-script.js
  |- ... and so on
```

The files must follow the convention [version].[action].[optional-description].[sql|js]. 

**Version** must be a number, but you may start and increment the numbers in any way you'd like. 
If you choose to use a purely sequential numbering scheme instead of something based off a timestamp, 
you will find it helpful to start with 000s or some large number for file organization purposes. 

**Action** must be either "do" or "undo". Do implements the version, and undo undoes it. Knex uses knex to do or undo it.

**Optional-description** can be a label or tag to help keep track of what happens inside the script. Descriptions should not contain periods.

To run your sql migrations with Postgrator, write a Node.js script or integrate postgrator with your application in some way:

```js  
var postgrator = require('postgrator');

postgrator.setConfig({
    migrationDirectory: __dirname + '/migrations', 
    schemaTable: 'schemaversion', // optional. default is 'schemaversion'
    driver: 'pg', // or pg.js, mysql, mssql, tedious
    host: '127.0.0.1',
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
postgrator.config.set({
    migrationDirectory: __dirname + '/migrations',
    driver: 'pg',
    connectionString: 'tcp://username:password@hosturl/databasename'
}); 

```


### SQL Server specific notes:

For SQL Server, you may optionally provide an additional options configuration. This may be necessary if requiring a secure connection for Azure.

```js  
postgrator.setConfig({
    migrationDirectory: __dirname + '/migrations', 
    schemaTable: 'schemaversion', // optional. default is 'schemaversion'
    driver: 'pg', // or pg.js, mysql, mssql, tedious
    host: '127.0.0.1',
    database: 'databasename',
    username: 'username',
    password: 'password',
    options: {
        encrypt: true
    }
}); 

```

Reference options for mssql for more details: [https://www.npmjs.com/package/mssql](https://www.npmjs.com/package/mssql)


## Compatible Drivers

Acceptable values for **driver** are: pg, pg.js, mysql, tedious, or mssql (the last 2 being MS SQL Server drivers). 

Despite the driver specified, Postgrator will use either pg.js, mysql, or mssql (which is wrapper around tedious) behind the scenes. All these drivers are purely javascript based, requiring no extra compilation. 



## Version 2.0 Notes

Despite the major version bump, postgrator's API has not changed. Some of its behavior has however:

- Migrating against a Postgres database now logs script checksums. Future migrations will confirm the checksum to ensure any previously run scripts have not been changed. This is a Postgres-only feature for now.
- Postgrator can always migrate to the latest version available by running ```postgrator.migrate('max', callback);```



## Version 1.0 Notes

- Configuration is now set via postgrator.setConfig instead of postgrator.config.set
- Postgrator connection can be closed via postgrator.endConnection
- Updated database drivers to latest versions
- refactored db client abstraction so that it's easier to understand



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


## License 

MIT
