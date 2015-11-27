exports.up = function(knex, Promise) {
	return Promise.all([
		knex('person').insert({name: 'knex', age: 3 })
	]);
};

exports.down = function(knex, Promise) {
	return Promise.all([
		knex('person')
			.where('name', 'knex')
			.del()
	]);
};
