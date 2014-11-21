

'use strict';

var async = require('async'),
	db = require('../database');



module.exports = function(Topics) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		year: 31104000000
	};

	Topics.getLatestTopics = function(uid, start, end, term, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestTids(start, end, term, next);
			},
			function(tids, next) {
				Topics.getTopics(tids, uid, next);
			},
			function(topics, next) {
				next(null, {topics: topics, nextStart: end + 1});
			}
		], callback);
	};

	Topics.getLatestTids = function(start, end, term, callback) {
		var since = terms.day;
		if (terms[term]) {
			since = terms[term];
		}

		var count = parseInt(end, 10) === -1 ? end : end - start + 1;

		db.getSortedSetRevRangeByScore('topics:recent', start, count, '+inf', Date.now() - since, callback);
	};

	Topics.updateTimestamp = function(tid, timestamp, callback) {
		async.parallel([
			function(next) {
				Topics.updateRecent(tid, timestamp, next);
			},
			function(next) {
				Topics.setTopicField(tid, 'lastposttime', timestamp, next);
			}
		], callback);
	};

	Topics.updateRecent = function(tid, timestamp, callback) {
		callback = callback || function() {};
		db.sortedSetAdd('topics:recent', timestamp, tid, callback);
	};
};
