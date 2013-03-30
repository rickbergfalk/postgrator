var assert = require('assert');
var async = require('async');

// NOTES ABOUT TESTS BELOW
// 
// The connection string used here is a postgres & mysql database on a cheapy host I'm using
// If you try testing using this database it'll fail, as the database uses an IP whitelist
// tcp://user:password@address/database

var tests = [];


/* Test original API to make sure its compatible
   We're going up and back down because we want to leave the database in a clean state for other tests
============================================================================= */
tests.push(function (callback) {
	console.log('\n----- testing original api to 003 -----');
	var postgrator = require('../postgrator.js');
	postgrator.setMigrationDirectory(__dirname + '/migrations');
	postgrator.setConnectionString("tcp://rickber2_test:TestUser@just63.justhost.com/rickber2_test"); 
	postgrator.migrate('003', function(err, migrations) {
		assert.ifError(err);
		callback();
	});
});

tests.push(function (callback) {
	console.log('\n----- testing original api to 000 -----');
	var postgrator = require('../postgrator.js');
	postgrator.setMigrationDirectory(__dirname + '/migrations');
	postgrator.setConnectionString("tcp://rickber2_test:TestUser@just63.justhost.com/rickber2_test"); 
	postgrator.migrate('000', function(err, migrations) {
		assert.ifError(err);
		callback();
	});
});


/* Test Connection String parsing
============================================================================= */
tests.push(function (callback) {
	console.log('\n----- testing that connection string parsing thing -----');
	var pg = require('../postgrator.js');
	var cs = "tcp://rickber2_test:TestUser@just63.justhost.com/rickber2_test";
	pg.config.setFromPostgresConnectionString(cs);
	assert.equal(pg.config.driver, 'pg', 'driver should be pg');
	assert.equal(pg.config.username, 'rickber2_test', 'username should be rickber2_test');
	assert.equal(pg.config.password, 'TestUser', 'password should be TestUser');
	assert.equal(pg.config.host, 'just63.justhost.com', 'host should be just63.justhost.com');
	assert.equal(pg.config.database, 'rickber2_test', 'database should be rickber2_test');
	assert.equal(pg.config.getPostgresConnectionString(), cs, 'config.setFromPostgresConnectionString (or the string passed to it) has a problem');
	callback();
});


/* Test config.set
============================================================================= */
tests.push(function (callback) {
	console.log('\n----- testing the new config.set thing -----');
	var pg = require('../postgrator.js');
	var directory = __dirname + '/migrations';
	var config = {
			migrationDirectory: directory,
			driver: 'mysql',
			host: 'just63.justhost.com',
			database: 'rickber2_test',
			username: 'rickber2_test',
			password: 'TestUser'
		}
	pg.config.set(config);
	assert.equal(pg.config.migrationDirectory, directory, 'the directory should be ' + directory);
	assert.equal(pg.config.driver, 'mysql', 'driver should be mysql');
	assert.equal(pg.config.username, 'rickber2_test', 'username should be rickber2_test');
	assert.equal(pg.config.password, 'TestUser', 'password should be TestUser');
	assert.equal(pg.config.host, 'just63.justhost.com', 'host should be just63.justhost.com');
	assert.equal(pg.config.database, 'rickber2_test', 'database should be rickber2_test');
	callback();
});


/* A function to build a set of tests for a given config.
   This will be helpful when we want to run the same kinds of tests on 
   postgres, mysql, sql server, etc.
============================================================================= */
var buildTestsForConfig = function (config) {

	/* Go 2 migrations up.
	------------------------------------------------------------------------- */
	tests.push(function (callback) {
		console.log('\n----- ' + config.driver + ' up to 002 -----');
		var pg = require('../postgrator.js');
		pg.config.set(config);
		pg.migrate('002', function(err, migrations) {
			assert.ifError(err);
			pg.runQuery('SELECT name, age FROM person', function (err, result) {
				assert.ifError(err);
				assert.equal(result.rows.length, 1, 'person table should have 1 record at this point');
				callback();
			});
		});
	});
	
	/* Go 1 migration up.
	------------------------------------------------------------------------- */
	tests.push(function (callback) {
		console.log('\n----- ' + config.driver + ' up to 003 -----');
		var pg = require('../postgrator.js');
		pg.config.set(config);
		pg.migrate('003', function(err, migrations) {
			assert.ifError(err);
			pg.runQuery('SELECT name, age FROM person', function (err, result) {
				assert.ifError(err);
				assert.equal(result.rows.length, 3, 'person table should have 3 records at this point');
				callback();
			});
		});
	});
	
	
	/* Go down to 0
	------------------------------------------------------------------------- */
	tests.push(function (callback) {
		console.log('\n----- ' + config.driver + ' down to 000 -----');
		var pg = require('../postgrator.js');
		pg.config.set(config);
		pg.migrate('00', function(err, migrations) {
			assert.ifError(err);
			callback();
		});
	});
	
};


buildTestsForConfig({
	migrationDirectory: __dirname + '/migrations',
	driver: 'pg',
	host: 'just63.justhost.com',
	database: 'rickber2_test',
	username: 'rickber2_test',
	password: 'TestUser'
});

buildTestsForConfig({
	migrationDirectory: __dirname + '/migrations',
	driver: 'mysql',
	host: 'just63.justhost.com',
	database: 'rickber2_test',
	username: 'rickber2_test',
	password: 'TestUser'
});

buildTestsForConfig({
	migrationDirectory: __dirname + '/migrations',
	driver: 'tedious',
	host: '127.0.0.1',
	database: 'myUtility',
	username: 'rickber2_test',
	password: 'TestUser1!'
});

	


/* Run the tests in an asyncy way
============================================================================= */
console.log("Running " + tests.length + " tests");
async.eachSeries(tests, function(testFunc, callback) {
	testFunc(callback);
}, function (err) {
	assert.ifError(err); // this won't ever happen, as we don't pass errors on in our test. But just in case we do some day...
	console.log('\nEverythings gonna be alright');
});



