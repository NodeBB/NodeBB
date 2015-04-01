

'use strict';

var async = require('async'),
	winston = require('winston'),
	db = require('../database');

module.exports = function(Topics) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		year: 31104000000
	};

	Topics.getLatestTopics = function(uid, start, stop, term, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestTidsFromSet('topics:recent', start, stop, term, next);
			},
			function(tids, next) {
				Topics.getTopics(tids, uid, next);
			},
			function(topics, next) {
				next(null, {topics: topics, nextStart: stop + 1});
			}
		], callback);
	};

	Topics.getLatestTids = function(start, stop, term, callback) {
		winston.warn('[deprecation warning] please use Topics.getLatestTidsFromSet("topics:recent")');
		Topics.getLatestTidsFromSet('topics:recent', start, stop, term, callback);
	};

	Topics.getLatestTidsFromSet = function(set, start, stop, term, callback) {
		var since = terms.day;
		if (terms[term]) {
			since = terms[term];
		}

		var count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;

		db.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since, callback);
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
