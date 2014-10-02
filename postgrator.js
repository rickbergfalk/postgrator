/*

	Postgrator
	
	DESCRIPTION
	
	Postgrator is a sql migration tool that uses plain SQL files. 
	The SQL migration scripts follow a convention to help maintain their order in which they are run.
	
    Starting with version 1.x.x of Postgrator, no database drivers will be installed as a dependency.
    You'll have to do that on your own.
    
    
	API:
	
    var postgrator = require('postgrator');
    
    postgrator.setConfig({
        driver: 'pg', // or pg.js, mssql, mysql, sqlite3, oracle
        driverVersion: 3,
        migrationDirectory: '',
        logProgress: true,
        host: '',
        database: '',
        username: '',
        password: ''
    });
    
    	postgrator.migrate(version, function (err, migrations) {});
	
	
	NOTES:
	
	If schemaversion table is not present, it will be created automatically!
	If no migration version is supplied, no migration is performed
	
	THINGS TO IMPLEMENT SOMEDAY (MAYBE)
	
	postgrator.migrate('max', callback); 	// migrate to the latest migration available
	postgrator.config.tableVersionName  	// not everyone will want a table called "schemaversion"
	
================================================================= */

var fs = require('fs');
var pg = require('pg.js'); 
var mysql = require('mysql');
var mssql = require('mssql');

var currentVersion;
var targetVersion;
var migrations = []; // array of objects like: {version: n, action: 'do', direction: 'up', filename: '0001.up.sql'}

var config = {
	migrationDirectory: null,
    connectionString: null,
	driver: 'pg',
	host: null,
	database: null,
	username: null,
	password: null,
	getPostgresConnectionString: function () {
		// "tcp://username:password@hosturl/databasename"
		if (config.connectionString) return config.connectionString;
        else return "tcp://" + this.username + ":" + this.password + "@" + this.host + "/" + this.database;
	}
};

exports.config = config;



/*  Set Config
================================================================= */
exports.setConfig = function (configuration) {
    if (configuration.host)                 this.host = configuration.host;
    if (configuration.database)             this.database = configuration.database;
    if (configuration.username)             this.username = configuration.username;
    if (configuration.password)             this.password = configuration.password;
    if (configuration.driver)               this.driver = configuration.driver;
    if (configuration.migrationDirectory)   this.migrationDirectory = configuration.migrationDirectory;
    if (configuration.connectionString)     this.connectionString = configuration.connectionString;
    
    // create universal client
    
    
};

function createUniversalClient (config) {
    
    var universalClient = {
        connected: false,
        createConnection: function () {},
        runQuery: function (query, rqCallback) { },
        endConnection: function (endCallback) {
            universalClient.connected = false;
            endCallback();
        }
    };
    
    universalClient.dbDriver = require(config.driver); // TODO - is this safe? does this work?
    universalClient.dbConnection;
    
    if (config.driver == 'mysql') {
        
        universalClient.createConnection = function (cb) {
            var connection = mysql.createConnection({
                multipleStatements: true,
                host: config.host,
                user: config.username,
                password: config.password,
                database: config.database
            });
            universalClient.dbConnection = connection;
            connection.connect(cb);
        };
        
        universalClient.runQuery = function (query, cb) {
            universalClient.dbConnection.query(query, function (err, rows, fields) {
                if (err) {
                    cb(err);
                } else {
                    var results = {};
                    if (rows) results.rows = rows;
                    if (fields) results.fields = fields;
                    cb(err, results);
                }
            });
        };
        
        universalClient.endConnection = function (cb) {
            universalClient.dbConnection.end(cb);
        };
        
        
    } else if (config.driver === 'pg' || config.driver === 'pg.js') {
        
        universalClient.createConnection = function (cb) {
            universalClient.dbConnection = new universalClient.dbDriver.Client(config.getPostgresConnectionString());
            universalClient.dbConnection.connect(function (err) {
                cb(err);
            });
        };
        
        universalClient.runQuery = function (query, cb) {
            universalClient.dbConnection.query(query, function (err, result) {
                cb(err, result);
            });
        };
        
        universalCLient.endConnection = function (cb) {
            universalClient.dbConnection.end();
            cb();
        };
    
    } else if (config.driver == 'mssql') {
        
        var sqlconfig = {
            user: config.username,
            password: config.password,
            server: config.host,
            database: config.database
        };
        
        universalClient.createConnection = function (cb) {
            universalClient.dbDriver.connect(sqlconfig, function (err) {
                cb(err);
            });
        };
        
        universalClient.runQuery = function (query, cb) {
            var request = new universalClient.dbDriver.Request();
            request.query(query, function (err, result) {
                cb(err, {rows: result});
            });    
        };
        
        universalClient.endConnection = function (cb) {
            // mssql doesn't offer a way to kill a single connection
            // It'll die on its own, and won't prevent us from creating additional connections.
            // eventually this should maybe use the pooling mechanism, even though we only need one connection
            cb();
        };
        
    } else {
        var err = new Error("db driver is not supported. Must either be 'mysql' or 'pg' or 'tedious' or 'mssql'");
    }
    
    return universalClient;
}


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
		if (m[m.length - 1] === 'sql') {
			migrations.push({
				version: Number(m[0]),
				direction: m[1],
				action: m[1],
				filename: file
			});
		}
	});
};


/* 
	createUniversalClient(callback)
	
	Internal function that creates a universal client 
	for running queries and ending the connection when things are done.
	
	It is called by runQuery if universalClient == false;
	
================================================================= */




var runQuery = function (query, rqCallback) {
	if (universalClient.connected) {
		universalClient.runQuery(query, rqCallback);
	} else {
		// create the universal client and run query
		createUniversalClient(function (err) {
			if (err) rqCallback(err);
			else universalClient.runQuery(query, rqCallback);
		});
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
	if (config.driver == 'pg' || config.driver == 'mysql') {
		query = 'SELECT version FROM schemaversion ORDER BY version DESC LIMIT 1';
	} else if (config.driver == 'tedious') {
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
	};
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
		});
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
				if (targetVersion === undefined) {
					console.log('no target version supplied - no migrations performed');	
				} else {
					var relevantMigrations = getRelevantMigrations(currentVersion, targetVersion);
					if (relevantMigrations.length > 0) {
						runMigrations(relevantMigrations, function(err, migrations) {
							if (err) finishedCallback(err, migrations);
							else {
								universalClient.endConnection(function (err) {
									if (err) console.log(err);
									finishedCallback(err, migrations);
								});	
							}
						});
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
	if (config.driver == 'pg') {
		checkQuery = "SELECT * FROM pg_catalog.pg_tables WHERE schemaname = CURRENT_SCHEMA AND tablename = 'schemaversion'";
		makeTableQuery = "CREATE TABLE schemaversion (version INT); INSERT INTO schemaversion (version) VALUES (0);";
	} else if (config.driver == 'mysql') {
		checkQuery = "SELECT * FROM information_schema.tables WHERE table_schema = '" + config.database + "' AND table_name = 'schemaversion'";
		makeTableQuery = "CREATE TABLE schemaversion (version INT); INSERT INTO schemaversion (version) VALUES (0);";
	} else if (config.driver == 'tedious') {
		checkQuery = "SELECT * FROM information_schema.tables WHERE table_schema = 'dbo' AND table_name = 'schemaversion'";
		makeTableQuery = "CREATE TABLE schemaversion (version INT); INSERT INTO schemaversion (version) VALUES (0);";
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
