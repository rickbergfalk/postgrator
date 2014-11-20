/*

	API:

    var postgrator = require('postgrator');

    postgrator.setConfig({
        driver: 'pg', // or pg.js, mysql, mssql, tedious
        migrationDirectory: '',
        logProgress: true,
        host: '',
        database: '',
        username: '',
        password: ''
    });

    postgrator.migrate(version, function (err, migrations) {
        // handle the error, and if you want end the connection
        postgrator.endConnection();
    });


	NOTES:

	If schemaversion table is not present, it will be created automatically!
	If no migration version is supplied, no migration is performed

	THINGS TO IMPLEMENT SOMEDAY (MAYBE)

	postgrator.migrate('max', callback); 	// migrate to the latest migration available
	postgrator.config.tableVersionName  	// not everyone will want a table called "schemaversion"

================================================================= */

var fs = require('fs');
var createCommonClient = require('./lib/create-common-client.js');

var commonClient;
var currentVersion;
var targetVersion;
var migrations = []; // array of objects like: {version: n, action: 'do', direction: 'up', filename: '0001.up.sql'}

var config = {};

exports.config = config;



/*  Set Config
================================================================= */
exports.setConfig = function (configuration) {
    config = configuration;
    commonClient = createCommonClient(configuration);
};



/*  Migration Sorting Functions
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


/*  runQuery
    connects the database driver if it is not currently connected.
    Executes an arbitrary sql query using the common client
================================================================= */
function runQuery (query, cb) {
	if (commonClient.connected) {
		commonClient.runQuery(query, cb);
	} else {
		// connect common client
		commonClient.createConnection(function (err) {
		    if (err) cb(err);
		    else {
		        commonClient.connected = true;
		        commonClient.runQuery(query, cb);
		    }
		});
	}
}
exports.runQuery = runQuery;


/*  endConnection
    Ends the commonClient's connection to the database
================================================================= */
function endConnection (cb) {
    if (commonClient.connected) {
        commonClient.endConnection(function () {
            commonClient.connected = false;
            cb();
        });
    } else {
        cb();
    }
}
exports.endConnection = endConnection;


/*
	getCurrentVersion(callback)

	Internal & External function
	Gets the current version of the schema from the database.

================================================================= */
var getCurrentVersion = function (callback) {
	runQuery(commonClient.queries.getCurrentVersion, function(err, result) {
		if (err) { // means the table probably doesn't exist yet. To lazy to check.
			console.error('something went wrong getting the Current Version from the schemaversion table');
		} else {
			if (result.rows.length > 0) currentVersion = result.rows[0].version;
			else currentVersion = 0;
		}
		callback(err, currentVersion);
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
function migrate (target, finishedCallback) {
	prep(function(err) {
		if (err) {
			if (finishedCallback) finishedCallback(err);
		}
		getMigrations();
		if (target && target === 'max') {
			targetVersion = Math.max.apply(null, migrations.map(function (migration) { return migration.version; }));
		} else if (target) {
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
							finishedCallback(err, migrations);
						});
					} else {
						if (finishedCallback) finishedCallback(err);
					}
				}
			}
		}); // get current version
	}); // prep
}
exports.migrate = migrate;


/*
	.prep(callback)

	Creates the table required for Postgrator to keep track of which migrations have been run.

	callback - function called after schema version table is built. function (err, results) {}

================================================================= */
function prep (callback) {
	runQuery(commonClient.queries.checkTable, function(err, result) {
		if (err) {
			err.helpfulDescription = 'Prep() table CHECK query Failed';
			callback(err);
		} else {
			if (result.rows && result.rows.length > 0) {
				callback();
			} else {
				console.log('table schemaversion does not exist - creating it.');
				runQuery(commonClient.queries.makeTable, function(err, result) {
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
}
