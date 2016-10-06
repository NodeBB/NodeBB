'use strict';
/*global require*/

var	assert = require('assert'),
	db = require('./mocks/databasemock');


describe('Test database', function() {
	it('should work', function(){
		assert.doesNotThrow(function(){
			var db = require('./mocks/databasemock');
		});
	});

	require('./database/keys');
	require('./database/list');
	require('./database/sets');
	require('./database/hash');
	require('./database/sorted');

});
