
'use strict';

var async = require('async');

var user = require('../user');
var meta = require('../meta');

var SocketBlacklist = module.exports;

SocketBlacklist.validate = function (socket, data, callback) {
	meta.blacklist.validate(data.rules, callback);
};

SocketBlacklist.save = function (socket, rules, callback) {
	async.waterfall([
		function (next) {
			user.isAdminOrGlobalMod(socket.uid, next);
		},
		function (isAdminOrGlobalMod, next) {
			if (!isAdminOrGlobalMod) {
				return callback(new Error('[[error:no-privileges]]'));
			}

			meta.blacklist.save(rules, next);
		},
	], callback);
};

SocketBlacklist.addRule = function (socket, rule, callback) {
	async.waterfall([
		function (next) {
			user.isAdminOrGlobalMod(socket.uid, next);
		},
		function (isAdminOrGlobalMod, next) {
			if (!isAdminOrGlobalMod) {
				return callback(new Error('[[error:no-privileges]]'));
			}

			meta.blacklist.addRule(rule, next);
		},
	], callback);
};
