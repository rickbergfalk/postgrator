#!/usr/bin/env node

var program = require('commander');

// for default: 
//.option('-n, --name [name]', 'your name [rick]', 'rick')

program
	.version('0.0.1')
	.option('-i, --info', 							'show db versions')
	.option('-e, --environment [environmentName]', 	'environment to migrate against.')
	.option('-m, --migration [migration]', 			'migration number to migrate to.')
	.parse(process.argv);


var askMigration = function(nextQuestion) {
	if (program.migration) {
		nextQuestion();
	} else {
		program.prompt('migration: ', function (migration) {
			program.migration = migration;
			nextQuestion();
		});
	}
};

var askEnvironment = function(nextQuestion) {
	if (program.environment) {
		nextQuestion();
	} else {
		var environments = ['development', 'staging', 'production'];
		console.log('Select environment:');
		program.choose(environments, function (i) {
			program.environment = environments[i];
			nextQuestion();
		});
	}
};


var finalAction = function () {
	console.log('Environment: %s', program.environment);
	console.log('Migration: %s', Number(program.migration));
	console.log(program.migration);
	console.log('Running the Migrations. Beep Boop');
	// ends the process
	process.stdin.destroy();
}


// Main routine:
if (program.info) {
	console.log('info requested, no further action necessary');
	process.stdin.destroy();
} else {
	askEnvironment(function() {
		askMigration(function() {
			finalAction();
		});
	});
}
	

