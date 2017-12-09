

'use strict';

var async = require('async');

var db = require('../database');
var privileges = require('../privileges');
var user = require('../user');
var meta = require('../meta');

module.exports = function (Topics) {
	Topics.getTopTopics = function (cid, uid, start, stop, filter, callback) {
		var topTopics = {
			nextStart: 0,
			topics: [],
		};
		if (cid && !Array.isArray(cid)) {
			cid = [cid];
		}
		async.waterfall([
			function (next) {
				var key = 'topics:votes';
				if (cid) {
					key = cid.map(function (cid) {
						return 'cid:' + cid + ':tids:votes';
					});
				}
				db.getSortedSetRevRange(key, 0, 199, next);
			},
			function (tids, next) {
				filterTids(tids, uid, filter, cid, next);
			},
			function (tids, next) {
				topTopics.topicCount = tids.length;
				tids = tids.slice(start, stop + 1);
				Topics.getTopicsByTids(tids, uid, next);
			},
			function (topicData, next) {
				topTopics.topics = topicData;
				topTopics.nextStart = stop + 1;
				next(null, topTopics);
			},
		], callback);
	};

	function filterTids(tids, uid, filter, cid, callback) {
		async.waterfall([
			function (next) {
				if (filter === 'watched') {
					Topics.filterWatchedTids(tids, uid, next);
				} else if (filter === 'new') {
					Topics.filterNewTids(tids, uid, next);
				} else if (filter === 'unreplied') {
					Topics.filterUnrepliedTids(tids, next);
				} else {
					Topics.filterNotIgnoredTids(tids, uid, next);
				}
			},
			function (tids, next) {
				privileges.topics.filterTids('read', tids, uid, next);
			},
			function (tids, next) {
				async.parallel({
					ignoredCids: function (next) {
						if (filter === 'watched' || parseInt(meta.config.disableRecentCategoryFilter, 10) === 1) {
							return next(null, []);
						}
						user.getIgnoredCategories(uid, next);
					},
					topicData: function (next) {
						Topics.getTopicsFields(tids, ['tid', 'cid'], next);
					},
				}, next);
			},
			function (results, next) {
				cid = cid && cid.map(String);
				tids = results.topicData.filter(function (topic) {
					if (topic && topic.cid) {
						return results.ignoredCids.indexOf(topic.cid.toString()) === -1 && (!cid || (cid.length && cid.indexOf(topic.cid.toString()) !== -1));
					}
					return false;
				}).map(function (topic) {
					return topic.tid;
				});
				next(null, tids);
			},
		], callback);
	}
};
