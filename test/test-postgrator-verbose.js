var assert = require('assert');
var async = require('async');

// NOTES ABOUT TESTS BELOW
// 
// The connection string used here is a postgres & mysql database on a cheapy host I'm using
// If you try testing using this database it'll fail, as the database uses an IP whitelist
// tcp://user:password@address/database

var tests = [];


/* Test original API to make sure its compatible
============================================================================= */
var testOriginalAPI = function (callback) {
	console.log('\n----- testing original api -----');
	var postgrator = require('../postgrator.js');
	postgrator.setMigrationDirectory(__dirname + '/migrations');
	postgrator.setConnectionString("tcp://rickber2_test:TestUser@just63.justhost.com/rickber2_test"); 
	console.log(postgrator.config);
	postgrator.migrate('003', function(err, migrations) {
		if (err) console.log(err);
		console.log('migrations:');
		console.log(migrations);
		callback();
	});
};
tests.push(testOriginalAPI);


/* Test Connection String parsing
============================================================================= */
var TestConnectionString = function (callback) {
	console.log('\n----- testing that connection string parsing thing -----');
	var pg = require('../postgrator.js');
	var cs = "tcp://rickber2_test:TestUser@just63.justhost.com/rickber2_test";
	pg.config.setFromPostgresConnectionString(cs);
	console.log(pg.config);
	assert.equal(pg.config.getPostgresConnectionString(), cs, 'config.setFromPostgresConnectionString (or the string passed to it) has a problem');
	//console.log(pg.config.getPostgresConnectionString());
	callback();
};
tests.push(TestConnectionString);


/* Run the tests in an asyncy way
============================================================================= */
async.eachSeries(tests, function(testFunc, callback) {
	testFunc(callback);
}, function (err) {
	if (err) {
		console.error('FAILURE DETECTED!');
		console.log(err);
	} else {
		console.log('\nthings must be okay?');
	}
});





/*

// other random test stuff

postgrator.getMigrations();

console.log('');
console.log(postgrator.getRelevantMigrations(0, 2));
console.log('');
console.log(postgrator.getRelevantMigrations(2, 1));
console.log('');
console.log(postgrator.getRelevantMigrations(2, 0));
console.log('');
console.log(postgrator.getRelevantMigrations(2, 2));


postgrator.getCurrentVersion(function(err, currentVersion) {
	console.log('');
	if (err) console.log(err);
	console.log('current version ' + currentVersion);
});

*/





