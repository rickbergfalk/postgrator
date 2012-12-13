# Postgrator

A PostgreSQL migration tool using plain sql scripts. 


## DISCLAIMER
Posgrator is a work in progress and will likely change. 

If that doesn't scare you, feel free to use it for whatever. I'm still figuring a lot of this stuff out, so any assistance is welcome :)


## Overview

Postgrator is a migration tool for PostgreSQL, using SQL instead of a DSL/library in some other language. 

Currently Postgrator is just an api for running the migrations. For now, you are stuck rolling your own method of using it (don't worry though, it is super simple). ~~There will be a command line interface once I figure out how to get that working~~ Actually, I can't get the native pg library working on Windows, so maybe not.


## Installation

```js
npm install postgrator
```


## Usage

### First, write some migrations

Create a folder to hold all your migration scripts. I call mine "migrations".

Next, write .sql script files as your migrations. Write the SQL just as you would as if you were running it directly against Postgres.

Migration files must abide by Postrator's naming convention, which is [version].[action].sql

*Version* must be a number. You may start at any number you want and increment by any number you want. 
It is helpful for file organization purposes to either start with 000s or start at some large number, like 100 or 1000.

*Action* will either be "do" or "undo". 
Other migration frameworks would use the terminology "up" and "down", but I've always found this confusing. 
Is up/down from or to a given version? With Postgrator you don't need to care. *do* implements the version, *undo* undoes it. No confusion necessary.

Here's how a migration folder might look:

* 001.do.sql
* 001.undo.sql
* 002.do.sql
* 002.undo.sql
* 003.do.sql
* ... and so on


### Next, prep your postgres database to work with Postgrator

Postgrator relies on a table called schemaversion to keep track of what version the database is at. 
It isn't anything big or fancy, and technically doesn't even really follow proper table design. 
It's just a bag of versions that have been run against the database.

*When you first run Postgrator, it will create this table.* In the future, this will probably be configurable, along with the name of the table.


### Next, write a node.js script that will run the desired migrations

Postgrator needs 3 pieces of information from you:
* the directory that holds your migrations
* the connection string for your PostgreSQL database
* the number you want to migrate to, as a number, or string. (It is converted to a Number internally if passed as a string)

Note:

* Postgrator automatically determines whether it needs to go "up" or "down", and will update the schemaversion table accordingly.
* If the database is already at the version specified to migrate to, Postgrator does nothing
* If a migration fails, Postgrator will stop running any further migrations
* Currently, the pg module is used to run the migrations, via its javascript library. I'll eventually add an option to use the native bindings.
* I'm not sure what happens if a migration takes a really long time to run...


```js
var postgrator = require('postgrator');
postgrator.setMigrationDirectory(__dirname + '/migrations');
postgrator.setConnectionString("tcp://user:password@address/database");
postgrator.migrate('001', callback(err, migrationsRun));
```