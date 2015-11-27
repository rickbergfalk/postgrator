var assert = require('assert');
var async = require('async');

var tests = [];
var pgUrl = "tcp://postgrator:postgrator@localhost/postgrator";

//process.env.PGSSLMODE = 'require';

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
	
	/* try migrating to current version.
    ------------------------------------------------------------------------- */
    tests.push(function (callback) {
        console.log('\n----- ' + config.driver + ' up to 002 -----');
        var pg = require('../postgrator.js');
        pg.setConfig(config);
        pg.migrate('002', function(err, migrations) {
            console.log('migrated to 002, current version');
            //console.log(err);
            //console.log(migrations);
            callback();
            /*
            assert.ifError(err);
            pg.runQuery('SELECT name, age FROM person', function (err, result) {
                assert.ifError(err);
                assert.equal(result.rows.length, 1, 'person table should have 1 record at this point');
                pg.endConnection(callback);
            });
            */
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

	/* Go up to 'max' (5)
	 ------------------------------------------------------------------------- */
	tests.push(function (callback) {
		console.log('\n----- ' + config.driver + ' up to max (005) -----');
		var pg = require('../postgrator.js');
		pg.setConfig(config);
		pg.migrate('max', function(err, migrations) {
			assert.ifError(err);
			pg.runQuery('SELECT name, age FROM person', function (err, result) {
				assert.ifError(err);
				assert.equal(result.rows.length, 5, 'person table should have 5 records at this point');
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
		setTimeout(function () {
		    pg.migrate('00', function(err, migrations) {
                assert.ifError(err);
                pg.endConnection(callback);
            });
		}, 10000);
	});
	
	/* remove version table for next run (to test table creation)
    ------------------------------------------------------------------------- */
    tests.push(function (callback) {
        console.log('\n----- ' + config.driver + ' removing schemaversion table -----');
        var pg = require('../postgrator.js');
        pg.setConfig(config);
        pg.runQuery('DROP TABLE schemaversion', function (err) {
            assert.ifError(err);
            pg.endConnection(callback);
        });
    });

};


buildTestsForConfig({
	migrationDirectory: __dirname + '/migrations',
	driver: 'pg.js',
	host: 'localhost',
	database: 'postgrator',
	username: 'postgrator',
	password: 'postgrator'
});


buildTestsForConfig({
	migrationDirectory: __dirname + '/migrations',
	driver: 'mysql',
	host: 'localhost',
	database: 'test',
	username: 'root',
	password: ''
});

/*
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
  process.exit(0);
});
