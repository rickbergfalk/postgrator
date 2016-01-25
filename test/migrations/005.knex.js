exports.do = function(knex, done) {
	knex('person').insert({name: 'knex', age: 3 }).asCallback(done);
};

exports.undo = function(knex, done) {
	knex('person').where('name', 'knex').del().asCallback(done);
};
