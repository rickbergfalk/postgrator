# Postgrator

A Node.js SQL migration tool using plain SQL scripts.



## Overview

Postgrator is a migration tool using SQL instead of a DSL/library in some other language. 
It currently supports PostgreSQL, MySQL, and SQL Server.


## usage

Create a folder and stick some SQL scripts in there that change your database in some way. It might look like:

```
migrations/
  |- 001.do.sql
  |- 001.undo.sql
  |- 002.do.sql
  |- 002.undo.sql
  |- ... and so on
```

The files must follow the convention [version].[action].sql. 

*Version* must be a number, but you may start and increment the numbers in any way you'd like. 
If you choose to use a purely sequential numbering scheme instead of something based off a timestamp, 
you will find it helpful to start with 000s or some large number for file organization purposes. 

*Action* must be either "do" or "undo". Do implements the version, and undo undoes it. 

To run your sql migrations with Postgrator, you'll write a Node.js script or add it to your application in some way: 

```js
var postgrator = require('postgrator');

postgrator.config.set({
    migrationDirectory: __dirname + '/migrations',  // path to the migrations
    driver: 'pg',                                   // or 'mysql' or 'tedious' (a non-native TDS SQL Server driver)
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



## Helpful Info

When first run against your database, *Postgrator will create a table called schemaversion.*
Postgrator relies on this table to track what version the database is at. 

Postgrator automatically determines whether it needs to go "up" or "down", and will update the schemaversion table accordingly.
If the database is already at the version specified to migrate to, Postgrator does nothing.

If a migration fails, Postgrator will stop running any further migrations.
It is up to you to migrate back down to the version you started at if you are running several migration scripts.
Because of this, keep in mind how you write your SQL - You may (or may not) want to write your SQL defensively 
(ie, check for pre-existing objects before you create new ones).

When running migrations against PostgreSQL, the non-native pg driver is utilized. 
This could eventually be a config setting if requested.

I'm not really sure what happens if a migration takes a really long time to run. 
Let me know if you run into any weird behavior.



## Installation

```js
npm install postgrator
```



## License 

(The MIT License)

Copyright (c) 2012 Rick Bergfalk

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.