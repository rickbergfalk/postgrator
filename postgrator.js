/*

	Postgrator
	a PostgreSQL migration tool for SQL people
	
	NEW IMPORTANT CHANGES!
	postgrator.migrate() now checks for the schemaversion table each time its called.
	If it does not exist, it creates it.
	This should maybe be toggleable in the future.
	
	postgrator.setMigrationDirectory(dir)								// sets the directory the migrations are found in
	postgrator.setConnectionString(conn)								// connectionstring
	postgrator.migrate() 												// does nothing
	postgrator.migrate(n, function(err, migrations){}) 					// migrates to a given version (determines up or down by itself)
	
	-- will not be officially documented (internal use only?)
	postgrator.getCurrentVersion(function(err, currentVersion) {})		// gets current version

================================================================= */

var fs = require('fs');
var pg = require('pg'); 



/* 
	Local variables and what not. 
	These are populated and referenced throughout this module.
	
================================================================= */
var currentVersion;
var targetVersion;
var migrations = []; // array of objects like: {version: n, action: 'do', direction: 'up', filename: '0001.up.sql'}
var migrationDirectory; 
var connectionString;



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
	var migrationFiles = fs.readdirSync(migrationDirectory);
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
	//console.log(migrations);
};



/* 
	runQuery(query, callback)
	
	Internal function
	Simple wrapper around pg module to execute some SQL.
	
================================================================= */
var runQuery = function (query, callback) {
	pg.connect(connectionString, function (err, client) {
		if (err) {
			if (callback) callback(err);
		} else {
			client.query(query, function(err, result) {
				if (callback) callback(err, result);
			});
		}
	});
};



/* 
	getCurrentVersion(callback)
	
	Internal & External function
	Gets the current version of the schema from the database.
	
================================================================= */
var getCurrentVersion = function (callback) {
	runQuery('SELECT version FROM schemaversion ORDER BY version DESC LIMIT 1', function(err, result) {
		if (err) { // means the table probably doesn't exist yet. To lazy to check.
			var error = new Error('Table schemaversion does not exist, or you are pointed at the wrong database. Schemaversion may be created using .prep() if desired.');
			error.dbErr = err;
		} else {
			currentVersion = result.rows[0].version;
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
	//console.log(migrations);
	var runNext = function (i) {
		console.log('running ' + migrations[i].filename);
		
		var sql = fs.readFileSync((migrationDirectory + '/' + migrations[i].filename), 'utf8');
		
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
						console.log('error updating the schemaversion table. (well, not *update* exactly...)');
						console.log(err);
					} else {
						// schemaversion successfully recorded. 
						// move on to next migration
						i = i + 1;
						//console.log('i is ' + i);
						//console.log('migrations length is ' + migrations.length);
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
	
	exports.prep(function(err) {
		
		if (err) {
			if (finishedCallback) finishedCallback(err);
		}
		
		getMigrations();
		
		if (target) {
			targetVersion = Number(target);
		} else {
			// TODO targetVersion = MAX(target)?
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
	
	Possible TODO: Allow customization of what the table is called or prefixed with.
	
IF NOT EXISTS (
    SELECT *
    FROM   pg_catalog.pg_tables 
    WHERE  schemaname = current_schema()
    AND    tablename  = 'schemaversion'
    ) THEN
		CREATE TABLE schemaversion (version INT); 
		INSERT INTO schemaversion (version) VALUES (0);
END IF;
	
================================================================= */
exports.prep = function (callback) {
	var checkQuery = "SELECT * FROM pg_catalog.pg_tables WHERE schemaname = CURRENT_SCHEMA AND tablename = 'schemaversion'";
	var makeTableQuery =  " CREATE TABLE schemaversion (version INT); "
						+ " INSERT INTO schemaversion (version) VALUES (0); "
	
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



/* 
	.setMigrationDirectory(directory)
	
	Sets the directory where the migration scripts can be found. 
	
================================================================= */
exports.setMigrationDirectory = function(dir) {
	migrationDirectory = dir;
};



/* 
	.setConnectionString(connectionString)
	
	Sets the connection string to be used. tcp://user:password@address/database
	
================================================================= */
exports.setConnectionString = function (cs) {
	connectionString = cs;
};


