var assert = require('assert');
var async = require('async');

var tests = [];
var pgUrl = "tcp://qblgodnjwwvqjr:auWYSDIW73KC1scgGv-VDquQGJ@ec2-54-204-24-154.compute-1.amazonaws.com/d42c6mk8cotcn2";

process.env.PGSSLMODE = 'require';

/* Test postgres connection string API
============================================================================= */
tests.push(function (callback) {
	console.log('\n----- testing original api to 003 -----');
	var postgrator = require('../postgrator.js');
	postgrator.setConfig({
        driver: 'pg.js',
        migrationDirectory: __dirname + '/migrations',
        connectionString: pgUrl
    });
	postgrator.migrate('003', function(err, migrations) {
		assert.ifError(err);
		postgrator.endConnection(callback);
	});
});

tests.push(function (callback) {
	console.log('\n----- testing original api to 000 -----');
	var postgrator = require('../postgrator.js');
	postgrator.setConfig({
        driver: 'pg.js',
        migrationDirectory: __dirname + '/migrations',
        connectionString: pgUrl
    }); 
	postgrator.migrate('000', function(err, migrations) {
		assert.ifError(err);
		postgrator.endConnection(callback);
	});
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
		pg.setConfig(config);
		pg.migrate('002', function(err, migrations) {
			assert.ifError(err);
			pg.runQuery('SELECT name, age FROM person', function (err, result) {
				assert.ifError(err);
				assert.equal(result.rows.length, 1, 'person table should have 1 record at this point');
				pg.endConnection(callback);
			});
		});
	});
	
	/* Go 1 migration up.
	------------------------------------------------------------------------- */
	tests.push(function (callback) {
		console.log('\n----- ' + config.driver + ' up to 003 -----');
		var pg = require('../postgrator.js');
		pg.setConfig(config);
		pg.migrate('003', function(err, migrations) {
			assert.ifError(err);
			pg.runQuery('SELECT name, age FROM person', function (err, result) {
				assert.ifError(err);
				assert.equal(result.rows.length, 3, 'person table should have 3 records at this point');
                pg.endConnection(callback);
			});
		});
	});
	
	
	/* Go down to 0
	------------------------------------------------------------------------- */
	tests.push(function (callback) {
		console.log('\n----- ' + config.driver + ' down to 000 -----');
		var pg = require('../postgrator.js');
		pg.setConfig(config);
		pg.migrate('00', function(err, migrations) {
			assert.ifError(err);
			pg.endConnection(callback);
		});
	});
	
};


buildTestsForConfig({
	migrationDirectory: __dirname + '/migrations',
	driver: 'pg.js',
	host: 'ec2-54-204-24-154.compute-1.amazonaws.com',
	database: 'd42c6mk8cotcn2',
	username: 'qblgodnjwwvqjr',
	password: 'auWYSDIW73KC1scgGv-VDquQGJ'
});
/*
buildTestsForConfig({
	migrationDirectory: __dirname + '/migrations',
	driver: 'mysql',
	host: 'blue2.corecloud.com',
	database: 'test',
	username: 'testuser',
	password: 'testuser'
});
buildTestsForConfig({
	migrationDirectory: __dirname + '/migrations',
	driver: 'tedious',
	host: '127.0.0.1',
	database: 'Utility',
	username: 'testuser',
	password: 'testuser'
});
*/


/* Run the tests in an asyncy way
============================================================================= */
console.log("Running " + tests.length + " tests");
async.eachSeries(tests, function(testFunc, callback) {
	testFunc(callback);
}, function (err) {
	assert.ifError(err); // this won't ever happen, as we don't pass errors on in our test. But just in case we do some day...
	console.log('\nEverythings gonna be alright');
});
