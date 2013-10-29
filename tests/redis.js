var	assert = require('assert');


describe('Test database', function() {
	it('should work', function(){
		assert.doesNotThrow(function(){
			var RDB = require('../mocks/redismock');
		});
	});
});
