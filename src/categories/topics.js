'use strict';

var async = require('async');

var db = require('../database');
var topics = require('../topics');
var plugins = require('../plugins');

module.exports = function(Categories) {

	Categories.getCategoryTopics = function(data, callback) {
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:category.topics.prepare', data, next);
			},
			function (data, next) {
				Categories.getTopicIds(data.set, data.reverse, data.start, data.stop, next);
			},
			function (tids, next) {
				topics.getTopicsByTids(tids, data.uid, next);
			},
			function (topics, next) {
				if (!Array.isArray(topics) || !topics.length) {
					return next(null, {topics: [], uid: data.uid});
				}

				for (var i=0; i<topics.length; ++i) {
					topics[i].index = data.start + i;
				}

				plugins.fireHook('filter:category.topics.get', {topics: topics, uid: data.uid}, next);
			},
			function (results, next) {
				next(null, {topics: results.topics, nextStart: data.stop + 1});
			}
		], callback);
	};

	Categories.modifyTopicsByPrivilege = function(topics, privileges) {
		if (!Array.isArray(topics) || !topics.length || privileges.isAdminOrMod) {
			return;
		}

		topics.forEach(function(topic) {
			if (topic.deleted && !topic.isOwner) {
				topic.title = '[[topic:topic_is_deleted]]';
				topic.slug = topic.tid;
				topic.teaser = null;
				topic.noAnchor = true;
				topic.tags = [];
			}
		});
	};

	Categories.getTopicIds = function(set, reverse, start, stop, callback) {
		if (reverse) {
			db.getSortedSetRevRange(set, start, stop, callback);
		} else {
			db.getSortedSetRange(set, start, stop, callback);
		}
	};

	Categories.getTopicIndex = function(tid, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				return callback(err);
			}

			db.sortedSetRevRank('cid:' + cid + ':tids', tid, callback);
		});
	};

	Categories.onNewPostMade = function(cid, pinned, postData, callback) {
		if (!cid || !postData) {
			return callback();
		}

		async.parallel([
			function(next) {
				db.sortedSetAdd('cid:' + cid + ':pids', postData.timestamp, postData.pid, next);
			},
			function(next) {
				db.incrObjectField('category:' + cid, 'post_count', next);
			},
			function(next) {
				if (parseInt(pinned, 10) === 1) {
					next();
				} else {
					db.sortedSetAdd('cid:' + cid + ':tids', postData.timestamp, postData.tid, next);
				}
			},
			function(next) {
				db.sortedSetIncrBy('cid:' + cid + ':tids:posts', 1, postData.tid, next);
			}
		], callback);
	};

};
