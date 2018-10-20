'use strict';

var async = require('async');
var topics = require('../../topics');
var privileges = require('../../privileges');

module.exports = function (SocketTopics) {
	SocketTopics.merge = function (socket, tids, callback) {
		if (!Array.isArray(tids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				async.map(tids, function (tid, next) {
					privileges.topics.isAdminOrMod(tid, socket.uid, next);
				}, next);
			},
			function (allowed, next) {
				if (allowed.includes(false)) {
					return next(new Error('[[error:no-privileges]]'));
				}
				topics.merge(tids, socket.uid, next);
			},
		], callback);
	};
};
