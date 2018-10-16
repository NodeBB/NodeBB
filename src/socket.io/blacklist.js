
'use strict';

var async = require('async');

var user = require('../user');
var meta = require('../meta');
var events = require('../events');

var SocketBlacklist = module.exports;

SocketBlacklist.validate = function (socket, data, callback) {
	meta.blacklist.validate(data.rules, callback);
};

SocketBlacklist.save = function (socket, rules, callback) {
	blacklist(socket, 'save', rules, callback);
};

SocketBlacklist.addRule = function (socket, rule, callback) {
	blacklist(socket, 'addRule', rule, callback);
};

function blacklist(socket, method, rule, callback) {
	async.waterfall([
		function (next) {
			user.isAdminOrGlobalMod(socket.uid, next);
		},
		function (isAdminOrGlobalMod, next) {
			if (!isAdminOrGlobalMod) {
				return callback(new Error('[[error:no-privileges]]'));
			}

			meta.blacklist[method](rule, next);
		},
		function (next) {
			events.log({
				type: 'ip-blacklist-' + method,
				uid: socket.uid,
				ip: socket.ip,
				rule: rule,
			}, next);
		},
	], callback);
}
