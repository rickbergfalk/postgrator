
var postgrator = require('../postgrator.js');

postgrator.setMigrationDirectory(__dirname + '/migrations');

// This connection string used here is a postgres database on a cheapy host I'm using
// If you try testing using this database it'll fail, as the database uses an IP whitelist
// tcp://user:password@address/database
postgrator.setConnectionString("tcp://rickber2_test:TestUser@just63.justhost.com/rickber2_test"); 

postgrator.migrate('003', function(err, migrations) {
	if (err) console.log(err);
	console.log(migrations);
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





