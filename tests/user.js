// this test currently needs to talk to the redis database.
// get the redis config info from root directory's config.json:
var winston = require('winston');

process.on('uncaughtException', function (err) {
	winston.error('Encountered error while running test suite: ' + err.message);
});

var	assert = require('assert'),
	db = require('../mocks/databasemock');

var User = require('../src/user');

describe('User', function() {
	var	userData;

	beforeEach(function(){
		userData = {
			name: 'John Smith',
			password: 'swordfish',
			email: 'john@example.com',
			callback: undefined
		};
	});


	describe('when created', function() {
		it('should be created properly', function(done){
			User.create(userData.name, userData.password, userData.email, function(error,userId){
				assert.equal(error, null, 'was created with error');
				assert.ok(userId);
				done();
			});
		});

		it('should have a valid email', function() {
			assert.throws(
				User.create(userData.name, userData.password, 'fakeMail',function(){}),
				Error,
				'does not validate email'
			);
		});
	});

	after(function() {
		db.flushdb();
	});
});