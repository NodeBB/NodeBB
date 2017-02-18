'use strict';


var	assert = require('assert');
var db = require('./mocks/databasemock');


describe('Test database', function () {
	it('should work', function () {
		assert.doesNotThrow(function () {
			require('./mocks/databasemock');
		});
	});

	it('should return info about database', function (done) {
		db.info(db.client, function (err, info) {
			assert.ifError(err);
			assert(info);
			done();
		});
	});

	require('./database/keys');
	require('./database/list');
	require('./database/sets');
	require('./database/hash');
	require('./database/sorted');

});
