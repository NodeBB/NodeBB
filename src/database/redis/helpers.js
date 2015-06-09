"use strict";

var helpers = {};

helpers.multiKeys = function(redisClient, command, keys, callback) {
	callback = callback || function() {};
	var multi = redisClient.multi();
	for (var i=0; i<keys.length; ++i) {
		multi[command](keys[i]);
	}
	multi.exec(callback);
};

helpers.multiKeysValue = function(redisClient, command, keys, value, callback) {
	callback = callback || function() {};
	var multi = redisClient.multi();
	for (var i=0; i<keys.length; ++i) {
		multi[command](keys[i], value);
	}
	multi.exec(callback);
};

helpers.multiKeyValues = function(redisClient, command, key, values, callback) {
	callback = callback || function() {};
	var multi = redisClient.multi();
	for (var i=0; i<values.length; ++i) {
		multi[command](key, values[i]);
	}
	multi.exec(callback);
};

helpers.resultsToBool = function(results) {
	for (var i=0; i<results.length; ++i) {
		results[i] = results[i] === 1;
	}
	return results;
};

module.exports = helpers;