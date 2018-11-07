

'use strict';

var async = require('async');

var db = require('../database');
var plugins = require('../plugins');
var posts = require('../posts');

module.exports = function (Topics) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		year: 31104000000,
	};

	Topics.getRecentTopics = function (cid, uid, start, stop, filter, callback) {
		Topics.getSortedTopics({
			cids: cid,
			uid: uid,
			start: start,
			stop: stop,
			filter: filter,
			sort: 'recent',
		}, callback);
	};

	/* not an orphan method, used in widget-essentials */
	Topics.getLatestTopics = function (uid, start, stop, term, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestTidsFromSet('topics:recent', start, stop, term, next);
			},
			function (tids, next) {
				Topics.getTopics(tids, uid, next);
			},
			function (topics, next) {
				next(null, { topics: topics, nextStart: stop + 1 });
			},
		], callback);
	};

	Topics.getLatestTidsFromSet = function (set, start, stop, term, callback) {
		var since = terms.day;
		if (terms[term]) {
			since = terms[term];
		}

		var count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;

		db.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since, callback);
	};

	Topics.updateLastPostTimeFromLastPid = function (tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestUndeletedPid(tid, next);
			},
			function (pid, next) {
				if (!pid) {
					return callback();
				}
				posts.getPostField(pid, 'timestamp', next);
			},
			function (timestamp, next) {
				if (!timestamp) {
					return callback();
				}
				Topics.updateLastPostTime(tid, timestamp, next);
			},
		], callback);
	};

	Topics.updateLastPostTime = function (tid, lastposttime, callback) {
		async.waterfall([
			function (next) {
				Topics.setTopicField(tid, 'lastposttime', lastposttime, next);
			},
			function (next) {
				Topics.getTopicFields(tid, ['cid', 'deleted', 'pinned'], next);
			},
			function (topicData, next) {
				var tasks = [
					async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids:lastposttime', lastposttime, tid),
				];

				if (!topicData.deleted) {
					tasks.push(async.apply(Topics.updateRecent, tid, lastposttime));
				}

				if (!topicData.pinned) {
					tasks.push(async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids', lastposttime, tid));
				}
				async.series(tasks, next);
			},
		], function (err) {
			callback(err);
		});
	};

	Topics.updateRecent = function (tid, timestamp, callback) {
		callback = callback || function () {};

		async.waterfall([
			function (next) {
				if (plugins.hasListeners('filter:topics.updateRecent')) {
					plugins.fireHook('filter:topics.updateRecent', { tid: tid, timestamp: timestamp }, next);
				} else {
					next(null, { tid: tid, timestamp: timestamp });
				}
			},
			function (data, next) {
				if (data && data.tid && data.timestamp) {
					db.sortedSetAdd('topics:recent', data.timestamp, data.tid, next);
				} else {
					next();
				}
			},
		], callback);
	};
};
