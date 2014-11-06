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
    driver: 'pg', 
    host: '127.0.0.1',
    database: 'databasename',
    username: 'username',
    password: 'password'
}); 

postgrator.migrate('002', function (err, migrations) {
	if (err) console.log(err)
	else console.log(migrations)
});
```

Alternatively, for Postgres you could also do:

```js  
var postgrator = require('postgrator');

postgrator.config.set({
    migrationDirectory: __dirname + '/migrations',
    driver: 'pg',
    connectionString: 'tcp://username:password@hosturl/databasename'
}); 

postgrator.migrate('002', function (err, migrations) {
	if (err) {
	    console.log(err)
	} else { 
	    console.log(migrations)
	}
	postgrator.endConnection(function () {
	    // connection is closed, unless you are using SQL Server
	});
});
```



## Compatible Drivers

Acceptable values for **driver** are: pg, pg.js, mysql, tedious, or mssql (the last 2 being MS SQL Server drivers). 

Despite the driver specified, Postgrator will use either pg.js, mysql, or mssql (which is wrapper around tedious) behind the scenes. All these drivers are purely javascript based, requiring no extra compilation. 



## Helpful Info

When first run against your database, *Postgrator will create a table called schemaversion.* Postgrator relies on this table to track what version the database is at. 

Postgrator automatically determines whether it needs to go "up" or "down", and will update the schemaversion table accordingly. If the database is already at the version specified to migrate to, Postgrator does nothing.

If a migration fails, Postgrator will stop running any further migrations. It is up to you to migrate back down to the version you started at if you are running several migration scripts. Because of this, keep in mind how you write your SQL - You may (or may not) want to write your SQL defensively (ie, check for pre-existing objects before you create new ones).



## Version 1.0 Notes

- Configuration is now set via postgrator.setConfig instead of postgrator.config.set
- Postgrator connection can be closed via postgrator.endConnection
- Updated database drivers to latest versions
- refactored db client abstraction so that it's easier to understand



## Installation

```js
npm install postgrator
```


## License 

MIT