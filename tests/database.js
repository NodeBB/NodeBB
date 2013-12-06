var	assert = require('assert');


describe('Test database', function() {
	it('should work', function(){
		assert.doesNotThrow(function(){
			var db = require('../mocks/databasemock');
		});
	});
});
