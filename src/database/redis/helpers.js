'use strict';

var helpers = module.exports;

helpers.noop = function () {};

helpers.execKeys = function (redisClient, type, command, keys, callback) {
	callback = callback || function () {};
	var queue = redisClient[type]();
	for (var i = 0; i < keys.length; i += 1) {
		queue[command](keys[i]);
	}
	queue.exec(callback);
};

helpers.execKeysValue = function (redisClient, type, command, keys, value, callback) {
	callback = callback || function () {};
	var queue = redisClient[type]();
	for (var i = 0; i < keys.length; i += 1) {
		queue[command](String(keys[i]), String(value));
	}
	queue.exec(callback);
};

helpers.execKeyValues = function (redisClient, type, command, key, values, callback) {
	callback = callback || function () {};
	var queue = redisClient[type]();
	for (var i = 0; i < values.length; i += 1) {
		queue[command](String(key), String(values[i]));
	}
	queue.exec(callback);
};

helpers.resultsToBool = function (results) {
	for (var i = 0; i < results.length; i += 1) {
		results[i] = results[i] === 1;
	}
	return results;
};
