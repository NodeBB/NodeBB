'use strict';

var db = require('../database');

module.exports = function (Topics) {
	Topics.isOwner = function (tid, uid, callback) {
		uid = parseInt(uid, 10);
		if (!uid) {
			return callback(null, false);
		}
		Topics.getTopicField(tid, 'uid', function (err, author) {
			callback(err, parseInt(author, 10) === uid);
		});
	};

	Topics.getUids = function (tid, callback) {
		db.getSortedSetRevRangeByScore('tid:' + tid + ':posters', 0, -1, '+inf', 1, callback);
	};
};
