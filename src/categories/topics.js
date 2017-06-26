'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var topics = require('../topics');
var plugins = require('../plugins');
var meta = require('../meta');

module.exports = function (Categories) {
	Categories.getCategoryTopics = function (data, callback) {
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:category.topics.prepare', data, next);
			},
			function (data, next) {
				Categories.getTopicIds(data, next);
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

	Categories.getTopicIds = function (data, callback) {
		var pinnedTids;

		async.waterfall([
			function (next) {
				var dataForPinned = _.cloneDeep(data);
				dataForPinned.start = 0;
				dataForPinned.stop = -1;
				Categories.getPinnedTids(dataForPinned, next);
			},
			function (_pinnedTids, next) {
				var totalPinnedCount = _pinnedTids.length;

				pinnedTids = _pinnedTids.slice(data.start, data.stop === -1 ? undefined : data.stop + 1);

				var pinnedCount = pinnedTids.length;

				var topicsPerPage = data.stop - data.start + 1;

				var normalTidsToGet = Math.max(0, topicsPerPage - pinnedCount);

				if (!normalTidsToGet && data.stop !== -1) {
					return next(null, []);
				}

				if (plugins.hasListeners('filter:categories.getTopicIds')) {
					return plugins.fireHook('filter:categories.getTopicIds', {
						tids: [],
						data: data,
						pinnedTids: pinnedTids,
						allPinnedTids: _pinnedTids,
						totalPinnedCount: totalPinnedCount,
						normalTidsToGet: normalTidsToGet,
					}, function (err, data) {
						callback(err, data && data.tids);
					});
				}

				var set = Categories.buildTopicsSortedSet(data);
				var reverse = Categories.getSortedSetRangeDirection(data.sort);
				var start = data.start;
				if (start > 0 && totalPinnedCount) {
					start -= totalPinnedCount - pinnedCount;
				}

				var stop = data.stop === -1 ? data.stop : start + normalTidsToGet - 1;

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

	Categories.getTopicCount = function (data, callback) {
		if (plugins.hasListeners('filter:categories.getTopicCount')) {
			return plugins.fireHook('filter:categories.getTopicCount', {
				topicCount: data.category.topic_count,
				data: data,
			}, function (err, data) {
				callback(err, data && data.topicCount);
			});
		}
		var set = Categories.buildTopicsSortedSet(data);
		if (Array.isArray(set)) {
			db.sortedSetIntersectCard(set, callback);
		} else {
			callback(null, data.category.topic_count);
		}
	};

	Categories.buildTopicsSortedSet = function (data) {
		var cid = data.cid;
		var set = 'cid:' + cid + ':tids';
		var sort = data.sort || (data.settings && data.settings.categoryTopicSort) || meta.config.categoryTopicSort || 'newest_to_oldest';

		if (sort === 'most_posts') {
			set = 'cid:' + cid + ':tids:posts';
		}

		if (data.targetUid) {
			set = 'cid:' + cid + ':uid:' + data.targetUid + ':tids';
		}

		if (data.tag) {
			if (Array.isArray(data.tag)) {
				set = [set].concat(data.tag.map(function (tag) {
					return 'tag:' + tag + ':topics';
				}));
			} else {
				set = [set, 'tag:' + data.tag + ':topics'];
			}
		}
		return set;
	};

	Categories.getSortedSetRangeDirection = function (sort) {
		sort = sort || 'newest_to_oldest';
		var reverse = sort === 'newest_to_oldest' || sort === 'most_posts';
		return reverse;
	};

	Categories.getAllTopicIds = function (cid, start, stop, callback) {
		db.getSortedSetRange(['cid:' + cid + ':tids:pinned', 'cid:' + cid + ':tids'], start, stop, callback);
	};

	Categories.getPinnedTids = function (data, callback) {
		if (plugins.hasListeners('filter:categories.getPinnedTids')) {
			return plugins.fireHook('filter:categories.getPinnedTids', {
				pinnedTids: [],
				data: data,
			}, function (err, data) {
				callback(err, data && data.pinnedTids);
			});
		}

		db.getSortedSetRevRange('cid:' + data.cid + ':tids:pinned', data.start, data.stop, callback);
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
