'use strict';

var db = require('../database');

module.exports = function (Topics) {
	Topics.isOwner = function (tid, uid, callback) {
		uid = parseInt(uid, 10);
		if (uid <= 0) {
			return setImmediate(callback, null, false);
		}
		Topics.getTopicField(tid, 'uid', function (err, author) {
			callback(err, author === uid);
		});
	};

	Topics.getUids = function (tid, callback) {
		db.getSortedSetRevRangeByScore('tid:' + tid + ':posters', 0, -1, '+inf', 1, callback);
	};
};
