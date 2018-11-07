'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var topics = require('../topics');
var plugins = require('../plugins');
var meta = require('../meta');
var user = require('../user');

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
			async.apply(user.blocks.filter, data.uid),
			function (topicsData, next) {
				if (!topicsData.length) {
					return next(null, { topics: [], uid: data.uid });
				}
				topics.calculateTopicIndices(topicsData, data.start);

				plugins.fireHook('filter:category.topics.get', { cid: data.cid, topics: topicsData, uid: data.uid }, next);
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

				async.parallel({
					pinnedTids: async.apply(Categories.getPinnedTids, dataForPinned),
					set: async.apply(Categories.buildTopicsSortedSet, data),
					direction: async.apply(Categories.getSortedSetRangeDirection, data.sort),
				}, next);
			},
			function (results, next) {
				var totalPinnedCount = results.pinnedTids.length;

				pinnedTids = results.pinnedTids.slice(data.start, data.stop !== -1 ? data.stop + 1 : undefined);

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
						allPinnedTids: results.pinnedTids,
						totalPinnedCount: totalPinnedCount,
						normalTidsToGet: normalTidsToGet,
					}, function (err, data) {
						callback(err, data && data.tids);
					});
				}

				var set = results.set;
				var direction = results.direction;
				var start = data.start;
				if (start > 0 && totalPinnedCount) {
					start -= totalPinnedCount - pinnedCount;
				}

				var stop = data.stop === -1 ? data.stop : start + normalTidsToGet - 1;

				if (Array.isArray(set)) {
					var weights = set.map(function (s, index) {
						return index ? 0 : 1;
					});
					db[direction === 'highest-to-lowest' ? 'getSortedSetRevIntersect' : 'getSortedSetIntersect']({ sets: set, start: start, stop: stop, weights: weights }, next);
				} else {
					db[direction === 'highest-to-lowest' ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop, next);
				}
			},
			function (normalTids, next) {
				normalTids = normalTids.filter(tid => !pinnedTids.includes(tid));

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
		async.waterfall([
			function (next) {
				Categories.buildTopicsSortedSet(data, next);
			},
			function (set, next) {
				if (Array.isArray(set)) {
					db.sortedSetIntersectCard(set, next);
				} else {
					next(null, data.category.topic_count);
				}
			},
		], callback);
	};

	Categories.buildTopicsSortedSet = function (data, callback) {
		var cid = data.cid;
		var set = 'cid:' + cid + ':tids';
		var sort = data.sort || (data.settings && data.settings.categoryTopicSort) || meta.config.categoryTopicSort || 'newest_to_oldest';

		if (sort === 'most_posts') {
			set = 'cid:' + cid + ':tids:posts';
		} else if (sort === 'most_votes') {
			set = 'cid:' + cid + ':tids:votes';
		}

		if (data.targetUid) {
			set = 'cid:' + cid + ':uid:' + data.targetUid + ':tids';
		}

		if (data.tag) {
			if (Array.isArray(data.tag)) {
				set = [set].concat(data.tag.map(tag => 'tag:' + tag + ':topics'));
			} else {
				set = [set, 'tag:' + data.tag + ':topics'];
			}
		}
		plugins.fireHook('filter:categories.buildTopicsSortedSet', {
			set: set,
			data: data,
		}, function (err, data) {
			callback(err, data && data.set);
		});
	};

	Categories.getSortedSetRangeDirection = function (sort, callback) {
		sort = sort || 'newest_to_oldest';
		var direction = sort === 'newest_to_oldest' || sort === 'most_posts' || sort === 'most_votes' ? 'highest-to-lowest' : 'lowest-to-highest';
		plugins.fireHook('filter:categories.getSortedSetRangeDirection', {
			sort: sort,
			direction: direction,
		}, function (err, data) {
			callback(err, data && data.direction);
		});
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

	Categories.onNewPostMade = function (cid, pinned, postData, callback) {
		if (!cid || !postData) {
			return setImmediate(callback);
		}

		async.parallel([
			function (next) {
				db.sortedSetAdd('cid:' + cid + ':pids', postData.timestamp, postData.pid, next);
			},
			function (next) {
				db.sortedSetAdd('cid:' + cid + ':tids:lastposttime', postData.timestamp, postData.tid, next);
			},
			function (next) {
				db.incrObjectField('category:' + cid, 'post_count', next);
			},
			function (next) {
				if (pinned) {
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
