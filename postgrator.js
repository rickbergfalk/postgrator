/*

	Postgrator
	
	DESCRIPTION
	
	Postgrator is a sql migration tool that uses plain SQL files. 
	The SQL migration scripts follow a convention to help maintain their order in which they are run.
	
	API:
	
	var postgrator = require('postgrator');
	postgrator.config.set(configuration); // dbdriver, host, dbname,  username, password, migrationDirectory
	postgrator.migrate(version, function (err, migrations) {});
	
	DEPRECATED API:
	
	postgrator.setMigrationDirectory(dir);
	postgrator.setConnectionString(conn);
	
	NOTES:
	
	If schemaversion table is not present, it will be created automatically!
	If no migration version is supplied, no migration is performed
	
	THINGS TO IMPLEMENT SOMEDAY (MAYBE)
	
	postgrator.migrate('max', callback); 	// migrate to the latest migration available
	postgrator.config.tableVersionName  	// not everyone will want a table called "schemaversion"
	
================================================================= */

var fs = require('fs');
var pg = require('pg'); 
var mysql = require('mysql');
var tedious = require('tedious');


/* 
	Local variables and what not. 
	These are populated and referenced throughout this module.
	
================================================================= */
var currentVersion;
var targetVersion;
var migrations = []; // array of objects like: {version: n, action: 'do', direction: 'up', filename: '0001.up.sql'}

var config = {
	migrationDirectory: null,
	dbdriver: 'pg',
	host: null,
	dbname: null,
	username: null,
	password: null,
	getPostgresConnectionString: function () {
		// "tcp://username:password@hosturl/databasename"
		return "tcp://" + this.username + ":" + this.password + "@" + this.host + "/" + this.dbname;
	},
	setFromPostgresConnectionString: function (connectionString) {
		var cs = connectionString.replace(/tcp:\/\//gi, '');
		var credentialsDatabase = cs.split('@');
		var credentials = credentialsDatabase[0];
		var database = credentialsDatabase[1];
		var usernamePassword = credentials.split(':');
		var hostDbname = database.split('/');
		
		this.host = hostDbname[0];
		this.dbname = hostDbname[1];
		this.username = usernamePassword[0];
		this.password = usernamePassword[1];
	},
	set: function (configuration) {
		if (configuration.host) 				this.host = configuration.host;
		if (configuration.dbname) 				this.dbname = configuration.dbname;
		if (configuration.username) 			this.username = configuration.username;
		if (configuration.password) 			this.password = configuration.password;
		if (configuration.dbdriver) 			this.dbdriver = configuration.dbdriver;
		if (configuration.migrationDirectory) 	this.migrationDirectory = configuration.migrationDirectory;
	}
}

exports.config = config;

/* 
	Sorting Functions
	
	Internal functions
	Used to sort the migrations. 
	
================================================================= */
var sortMigrationsAsc = function (a,b) {
	if (a.version < b.version)
		return -1;
	if (a.version > b.version)
		return 1;
	return 0;
};
	
var sortMigrationsDesc = function (a, b) {
	if (a.version < b.version)
		return 1;
	if (a.version > b.version)
		return -1;
	return 0;
};



/* 
	getMigrations()
	
	Internal function
	Reads the migration directory for all the migration files.
	It is SYNC out of laziness and simplicity
	
================================================================= */	
var getMigrations = function () {
	migrations = [];
	var migrationFiles = fs.readdirSync(config.migrationDirectory);
	migrationFiles.forEach(function(file) {
		var m = file.split('.');
		if (m[2] === 'sql') {
			migrations.push({
				version: Number(m[0]),
				direction: m[1],
				action: m[1],
				filename: file
			})
		}
	});
};



/* 
	runQuery(query, callback)
	
	Internal function
	Simple wrapper around the driver modules to execute some SQL.
	The results passed on to the callback will at least contain a rows array of row objects
	results = {
		rows: [
			{
				colname: value
			}
		]
	}
	
================================================================= */
var runQuery = function (query, callback) {
	
	if (config.dbdriver == 'mysql') {
		
		var connection = mysql.createConnection({
			multipleStatements: true,
			host: config.host,
			user: config.username,
			password: config.password,
			database: config.dbname
		});
		connection.connect(function (err) {
			if (err) {
				if (callback) callback(err);
			} else {
				connection.query(query, function (err, rows, fields) {
					if (err) {
						if (callback) callback(err);
					} else {
						var results = {};
						if (rows) results.rows = rows;
						if (fields) results.fields = fields;
						connection.end(function (err) {
							callback(err, results);
						})
					}
				});
			}
		});
			
		
	} else if (config.dbdriver == 'pg') {
		
		pg.connect(config.getPostgresConnectionString(), function (err, client, done) {
			currentConnection = client;
			if (err) {
				if (callback) callback(err);
				done();
			} else {
				client.query(query, function(err, result) {
					done();
					if (callback) callback(err, result);
				});
			}
		});
	
	} else if (config.dbdriver == 'tedious') {
		
		var connection = new tedious.Connection({
			userName: 	config.username,
			password: 	config.password,
			server: 	config.host, 
			options: {
				database: 	config.dbname
			}
		});
		connection.on('connect', function (err) {
			if (err) {
				console.log(err);
				callback(err);
				connection.close();
			} else {
				var finalData = {
					rowCount: null,
					columns: null,
					rows: []
				};
				request = new tedious.Request(query, function(err, rowCount) {
					if (err) {
						console.log(err);
						callback(err);
						connection.close();
					} else {
						// This is where we end up if the query completes successfully
						// (mix of callback and event style stuff is sometimes hard to follow)
						finalData.rowCount = rowCount;
						connection.close();
						callback(err, finalData);
					}
				});
				request.on('columnMetadata', function (columns) {
					finalData.columns = columns;
				});
				request.on('row', function(row) {
					// Capture the row data and format it to the same style object that the other drivers are using
					// it should be like:
					// row = {colname: value, anotherColName: anothervalue}
					var cleanRow = {};
					for (var i = 0; i < row.length; i++) {
						var columnName = row[i].metadata.colName;
						var value = row[i].value;
						cleanRow[columnName] = value;
					}
					finalData.rows.push(cleanRow);
				});
				connection.execSql(request);
			}
		});
	
	} else {
		var err = new Error("db driver is not supported. Must either be 'mysql' or 'pg' or 'tedious'");
		callback(err);
	}
		
};
exports.runQuery = runQuery;


/* 
	getCurrentVersion(callback)
	
	Internal & External function
	Gets the current version of the schema from the database.
	
================================================================= */
var getCurrentVersion = function (callback) {
	var query;
	if (config.dbdriver == 'pg' || config.dbdriver == 'mysql') {
		query = 'SELECT version FROM schemaversion ORDER BY version DESC LIMIT 1';
	} else if (config.dbdriver == 'tedious') {
		query = 'SELECT TOP 1 version FROM schemaversion ORDER BY version DESC';
	}
	runQuery(query, function(err, result) {
		if (err) { // means the table probably doesn't exist yet. To lazy to check.
			console.error('something went wrong getting the Current Version from the schemaversion table');
		} else {
			if (result.rows.length > 0) currentVersion = result.rows[0].version;
			else currentVersion = 0;
		}
		if (callback) callback(err, currentVersion);
	});
};
exports.getCurrentVersion = getCurrentVersion;

	

/* 
	runMigrations(migrations, finishedCallback)
	
	Internal function
	Runs the migrations in the order provided, using a recursive kind of approach
	For each migration run:
		- the contents of the script is read (sync because I'm lazy)
		- script is run. 
			if error, the callback is called and we don't run anything else
			if success, we then add/remove a record from the schemaversion table to keep track of the migration we just ran
		- if all goes as planned, we run the next migration
		- once all migrations have been run, we call the callback.
		
================================================================= */
var runMigrations = function (migrations, finishedCallback) {
	
	var runNext = function (i) {
		console.log('running ' + migrations[i].filename);
		
		var sql = fs.readFileSync((config.migrationDirectory + '/' + migrations[i].filename), 'utf8');
		
		runQuery(sql, function(err, result) {
			if (err) {
				console.log('Error in runMigrations()');
				if (finishedCallback) {
					finishedCallback(err, migrations);
				}
			} else {
				// migration ran successfully
				// add version to schemaversion table. 
				runQuery(migrations[i].schemaVersionSQL, function(err, result) {
					if (err) {
						// SQL to update schemaversion failed.
						console.log('error updating the schemaversion table');
						console.log(err);
					} else {
						// schemaversion successfully recorded. 
						// move on to next migration
						i = i + 1;
						if (i < migrations.length) {
							runNext(i);
						} else {
							// We are done running the migrations. 
							// run the finished callback if supplied.
							console.log('done');
							if (finishedCallback) {
								finishedCallback(null, migrations);
							}
						}
					}
				});	
			}
		});
		
	}
	runNext(0);
};
	

	
/* 
	.getRelevantMigrations(currentVersion, targetVersion)
	
	returns an array of relevant migrations based on the target and current version passed.
	returned array is sorted in the order it needs to be run
	
================================================================= */
var getRelevantMigrations = function (currentVersion, targetVersion) {
	var relevantMigrations = [];
	
	if (targetVersion > currentVersion) {
	
		// we are migrating up
		// get all up migrations > currentVersion and <= targetVersion
		console.log('migrating up to ' + targetVersion);
		migrations.forEach(function(migration) {
			if (migration.action == 'do' && migration.version > currentVersion && migration.version <= targetVersion) {
				migration.schemaVersionSQL = 'INSERT INTO schemaversion (version) VALUES (' + migration.version + ');';
				relevantMigrations.push(migration);
			}
		})
		relevantMigrations = relevantMigrations.sort(sortMigrationsAsc);
	
	} else if (targetVersion < currentVersion) {
		
		// we are going to migrate down
		console.log('migrating down to ' + targetVersion);
		migrations.forEach(function(migration) {
			if (migration.action == 'undo' && migration.version <= currentVersion && migration.version > targetVersion) {
				migration.schemaVersionSQL = 'DELETE FROM schemaversion WHERE version = ' + migration.version + ';';
				relevantMigrations.push(migration);
			}
		});
		relevantMigrations = relevantMigrations.sort(sortMigrationsDesc);
		
	} else if (targetVersion == currentVersion) {
		console.log("database already at version " + targetVersion);
	}
	
	return relevantMigrations;
};



/* 
	.migrate(target, callback)
	
	Main method to move a schema to a particular version.
	A target must be specified, otherwise nothing is run.
	
	target - version to migrate to as string or number (will be handled as numbers internally)
	callback - callback to run after migrations have finished. function (err, migrations) {}
	
================================================================= */
exports.migrate = function (target, finishedCallback) {
	
	prep(function(err) {
		
		if (err) {
			if (finishedCallback) finishedCallback(err);
		}
		
		getMigrations();
		
		if (target) {
			targetVersion = Number(target);
		}
		
		getCurrentVersion(function(err, currentVersion) {
			if (err) {
				console.log('error getting current version');
				if (finishedCallback) finishedCallback(err);
			} else {
				console.log('version of database is: ' + currentVersion);
				if (targetVersion == undefined) {
					console.log('no target version supplied - no migrations performed');	
				} else {
					var relevantMigrations = getRelevantMigrations(currentVersion, targetVersion);
					if (relevantMigrations.length > 0) {
						runMigrations(relevantMigrations, finishedCallback);
					} else {
						if (finishedCallback) finishedCallback(err);
					}
				}	
			}
		}); // get current version
		
	}); // prep
	
};



/* 
	.prep(callback)
	
	Creates the table required for Postgrator to keep track of which migrations have been run.
	
	callback - function called after schema version table is built. function (err, results) {}
	
================================================================= */
var prep = function (callback) {
	var checkQuery;
	var makeTableQuery;
	
	if (config.dbdriver == 'pg') {
		checkQuery = "SELECT * FROM pg_catalog.pg_tables WHERE schemaname = CURRENT_SCHEMA AND tablename = 'schemaversion'";
		makeTableQuery = "CREATE TABLE schemaversion (version INT); INSERT INTO schemaversion (version) VALUES (0);"
	} else if (config.dbdriver == 'mysql') {
		checkQuery = "SELECT * FROM information_schema.tables WHERE table_schema = '" + config.dbname + "' AND table_name = 'schemaversion'";
		makeTableQuery = "CREATE TABLE schemaversion (version INT); INSERT INTO schemaversion (version) VALUES (0);"
	} else if (config.dbdriver == 'tedious') {
		checkQuery = "SELECT * FROM information_schema.tables WHERE table_schema = 'dbo' AND table_name = 'schemaversion'";
		makeTableQuery = "CREATE TABLE schemaversion (version INT); INSERT INTO schemaversion (version) VALUES (0);"
	}
	
	runQuery(checkQuery, function(err, result) {
		if (err) {
			err.helpfulDescription = 'Prep() table CHECK query Failed';
			callback(err);
		} else {
			if (result.rows && result.rows.length > 0) {
				callback();
			} else {
				console.log('table schemaversion does not exist - creating it.');
				runQuery(makeTableQuery, function(err, result) {
					if (err) {
						err.helpfulDescription = 'Prep() table BUILD query Failed';
						callback(err);
					} else {
						callback();
					}
				});
			} 
		}
	});
};
exports.prep = prep;


/* 
	DEPRECATED API
	
	.setMigrationDirectory(directory)
	.setConnectionString(connectionString)
	
================================================================= */
exports.setMigrationDirectory = function(dir) {
	console.warn('.setMigrationDirectory() is deprecated. use .config.set({options}) instead');
	config.migrationDirectory = dir;
};

exports.setConnectionString = function (cs) {
	console.warn('.setConnectionString() is deprecated. use .config.set({options}) instead');
	config.dbdriver = 'pg';
	config.setFromPostgresConnectionString(cs);
};
