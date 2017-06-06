'use strict';

var async = require('async');

var db = require('../database');
var topics = require('../topics');
var plugins = require('../plugins');

module.exports = function (Categories) {
	Categories.getCategoryTopics = function (data, callback) {
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:category.topics.prepare', data, next);
			},
			function (data, next) {
				Categories.getTopicIds(data.cid, data.set, data.reverse, data.start, data.stop, next);
			},
			function (tids, next) {
				topics.getTopicsByTids(tids, data.uid, next);
			},
			function (topics, next) {
				if (!topics.length) {
					return next(null, { topics: [], uid: data.uid });
				}

				for (var i = 0; i < topics.length; i += 1) {
					topics[i].index = data.start + i;
				}

				plugins.fireHook('filter:category.topics.get', { cid: data.cid, topics: topics, uid: data.uid }, next);
			},
			function (results, next) {
				next(null, { topics: results.topics, nextStart: data.stop + 1 });
			},
		], callback);
	};

	Categories.getTopicIds = function (cid, set, reverse, start, stop, callback) {
		var pinnedTids;
		var pinnedCount;
		var totalPinnedCount;

		async.waterfall([
			function (next) {
				Categories.getPinnedTids(cid, 0, -1, next);
			},
			function (_pinnedTids, next) {
				totalPinnedCount = _pinnedTids.length;

				pinnedTids = _pinnedTids.slice(start, stop === -1 ? undefined : stop + 1);

				pinnedCount = pinnedTids.length;

				var topicsPerPage = stop - start + 1;

				var normalTidsToGet = Math.max(0, topicsPerPage - pinnedCount);

				if (!normalTidsToGet && stop !== -1) {
					return next(null, []);
				}
				if (start > 0 && totalPinnedCount) {
					start -= totalPinnedCount - pinnedCount;
				}
				stop = stop === -1 ? stop : start + normalTidsToGet - 1;

				if (Array.isArray(set)) {
					db[reverse ? 'getSortedSetRevIntersect' : 'getSortedSetIntersect']({ sets: set, start: start, stop: stop }, next);
				} else {
					db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop, next);
				}
			},
			function (normalTids, next) {
				normalTids = normalTids.filter(function (tid) {
					return pinnedTids.indexOf(tid) === -1;
				});

				next(null, pinnedTids.concat(normalTids));
			},
		], callback);
	};

	Categories.getAllTopicIds = function (cid, start, stop, callback) {
		db.getSortedSetRange(['cid:' + cid + ':tids:pinned', 'cid:' + cid + ':tids'], start, stop, callback);
	};

	Categories.getPinnedTids = function (cid, start, stop, callback) {
		db.getSortedSetRevRange('cid:' + cid + ':tids:pinned', start, stop, callback);
	};

	Categories.modifyTopicsByPrivilege = function (topics, privileges) {
		if (!Array.isArray(topics) || !topics.length || privileges.isAdminOrMod) {
			return;
		}

		topics.forEach(function (topic) {
			if (topic.deleted && !topic.isOwner) {
				topic.title = '[[topic:topic_is_deleted]]';
				topic.slug = topic.tid;
				topic.teaser = null;
				topic.noAnchor = true;
				topic.tags = [];
			}
		});
	};

	Categories.getTopicIndex = function (tid, callback) {
		console.warn('[Categories.getTopicIndex] deprecated');
		callback(null, 1);
	};

	Categories.onNewPostMade = function (cid, pinned, postData, callback) {
		if (!cid || !postData) {
			return setImmediate(callback);
		}

		async.parallel([
			function (next) {
				db.sortedSetAdd('cid:' + cid + ':pids', postData.timestamp, postData.pid, next);
			},
			function (next) {
				db.incrObjectField('category:' + cid, 'post_count', next);
			},
			function (next) {
				if (parseInt(pinned, 10) === 1) {
					return setImmediate(next);
				}

				async.parallel([
					function (next) {
						db.sortedSetAdd('cid:' + cid + ':tids', postData.timestamp, postData.tid, next);
					},
					function (next) {
						db.sortedSetIncrBy('cid:' + cid + ':tids:posts', 1, postData.tid, next);
					},
				], function (err) {
					next(err);
				});
			},
			function (next) {
				Categories.updateRecentTid(cid, postData.tid, next);
			},
		], callback);
	};
};
