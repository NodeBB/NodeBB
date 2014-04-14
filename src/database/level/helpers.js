"use strict";

var helpers = {},
	async = require('async');

helpers.iterator = function(fn, keys, value, callback) {
	var results = [];

	async.each(keys, function(key, next) {
		module.parent.exports[fn](key, value, function(err, result) {
			results.push(result);
			next();
		});
	}, function(err) {
		callback(err, results);
	});
};

module.exports = helpers;