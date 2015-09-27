'use strict';

var async = require('async');

module.exports = function(User) {
	User.icon = {};

	User.icon.generate = function(uid, callback) {
		// For convenience, only backgrounds that work well with white as used
		var backgrounds = ['#AB4642', '#DC9656', '#A1B56C', '#7CAFC2', '#BA8BAF', '#A16946'],
			bgColor = backgrounds[Math.floor(Math.random() * backgrounds.length) + 1];

		User.getUserField(uid, 'username', function(err, username) {
			User.setUserFields(uid, {
				'icon:text': username.slice(0, 1).toUpperCase(),
				'icon:bgColor': bgColor
			}, callback);
		})
	}
};