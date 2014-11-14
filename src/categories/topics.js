'use strict';

var async = require('async'),
	db = require('../database'),
	topics = require('../topics'),
	plugins = require('../plugins');

module.exports = function(Categories) {

	Categories.getCategoryTopics = function(data, callback) {
		var tids;
		async.waterfall([
			async.apply(plugins.fireHook, 'filter:category.topics.prepare', data),
			function(data, next) {
				Categories.getTopicIds(data.targetUid ? 'cid:' + data.cid + ':uid:' + data.targetUid + ':tids' : 'cid:' + data.cid + ':tids', data.start, data.stop, next);
			},
			function(topicIds, next) {
				tids = topicIds;
				topics.getTopicsByTids(tids, data.uid, next);
			},
			function(topics, next) {
				if (!Array.isArray(topics) || !topics.length) {
					return next(null, {
						topics: [],
						nextStart: 1
					});
				}

				var indices = {},
					i = 0;
				for(i=0; i<tids.length; ++i) {
					indices[tids[i]] = data.start + i;
				}

				for(i=0; i<topics.length; ++i) {
					topics[i].index = indices[topics[i].tid];
				}

				plugins.fireHook('filter:category.topics.get', {topics: topics, uid: data.uid}, function(err, params) {
					next(null, {
						topics: params.topics,
						nextStart: data.stop + 1
					});
				});
			}
		], callback);
	};

	Categories.getTopicIds = function(set, start, stop, callback) {
		db.getSortedSetRevRange(set, start, stop, callback);
	};

	Categories.getTopicIndex = function(tid, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				return callback(err);
			}

			db.sortedSetRevRank('cid:' + cid + ':tids', tid, callback);
		});
	};

	Categories.onNewPostMade = function(postData, callback) {
		topics.getTopicFields(postData.tid, ['cid', 'pinned'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			if (!topicData || !topicData.cid) {
				return callback();
			}

			var cid = topicData.cid;

			async.parallel([
				function(next) {
					db.sortedSetAdd('cid:' + cid + ':pids', postData.timestamp, postData.pid, next);
				},
				function(next) {
					db.incrObjectField('category:' + cid, 'post_count', next);
				},
				function(next) {
					if (parseInt(topicData.pinned, 10) === 1) {
						next();
					} else {
						db.sortedSetAdd('cid:' + cid + ':tids', postData.timestamp, postData.tid, next);
					}
				}
			], callback);
		});
	};

};
