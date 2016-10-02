'use strict';
/*global require*/

var assert = require('assert'),
	utils = require('./../public/src/utils.js');


describe('Utility Methods', function(){
	describe('username validation', function(){
		it('accepts latin-1 characters', function(){
			var username = "John\"'-. Doeäâèéë1234";
			assert(utils.isUserNameValid(username), 'invalid username');
		});
		it('rejects empty string', function(){
			var username = '';
			assert.ifError(utils.isUserNameValid(username), 'accepted as valid username');
		});
	});

	describe('email validation', function(){
		it('accepts sample address', function(){
			var email = 'sample@example.com';
			assert(utils.isEmailValid(email), 'invalid email');
		});
		it('rejects empty address', function(){
			var email = '';
			assert.ifError(utils.isEmailValid(email), 'accepted as valid email');
		});
	});

	describe('UUID generation', function(){
		it('return unique random value every time', function(){
			var uuid1 = utils.generateUUID(),
				uuid2 = utils.generateUUID();
			assert.notEqual(uuid1, uuid2, 'matches');
		});
	});
});
