'use strict';

var async = require('async');
var db = require('../database');

module.exports = function (User) {
	User.getIgnoredTids = function (uid, start, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':ignored_tids', start, stop, callback);
	};

	User.addTopicIdToUser = function (uid, tid, timestamp, callback) {
		async.parallel([
			async.apply(db.sortedSetAdd, 'uid:' + uid + ':topics', timestamp, tid),
			async.apply(User.incrementUserFieldBy, uid, 'topiccount', 1),
		], callback);
	};
};
