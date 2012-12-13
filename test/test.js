/*
var config = require('./lib/config');

for (config in config.db) {
	console.log(config);
}
*/

var postgrator = require('../postgrator.js');

postgrator.setMigrationDirectory(__dirname + '/migrations');
postgrator.setConnectionString("tcp://rickber2_test:TestUser@just63.justhost.com/rickber2_test"); // tcp://user:password@address/database

postgrator.migrate('003', function(err, migrations) {
	if (err) console.log(err);
	console.log(migrations);
});



/*

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





