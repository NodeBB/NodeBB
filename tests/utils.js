var assert = require('assert'),
	utils = require('./../public/src/utils.js');


describe("Utility Methods", function(){
	describe("username validation", function(){
		it("accepts latin-1 characters", function(){
			var username = "John\"'-. Doeäâèéë1234";
			assert(utils.isUserNameValid(username), 'invalid username');
		});
	});
});
