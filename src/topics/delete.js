'use strict';

var async = require('async'),
	db = require('../database'),

	plugins = require('../plugins');


module.exports = function(Topics) {

	Topics.delete = function(tid, callback) {
		async.parallel([
			function(next) {
				Topics.setTopicField(tid, 'deleted', 1, next);
			},
			function(next) {
				Topics.removeRecent(tid, next);
			},
			function(next) {
				db.sortedSetsRemove(['topics:posts', 'topics:views'], tid, next);
			}
		], callback);
	};

	Topics.restore = function(tid, callback) {
		Topics.getTopicFields(tid, ['lastposttime', 'postcount', 'viewcount'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			async.parallel([
				function(next) {
					Topics.setTopicField(tid, 'deleted', 0, next);
				},
				function(next) {
					Topics.updateRecent(tid, topicData.lastposttime, next);
				},
				function(next) {
					db.sortedSetAdd('topics:posts', topicData.postcount, tid, next);
				},
				function(next) {
					db.sortedSetAdd('topics:views', topicData.viewcount, tid, next);
				}
			], callback);
		});
	};

	Topics.purge = function(tid, callback) {
		async.parallel([
			function(next) {
				db.deleteAll(['tid:' + tid + ':followers', 'tid:' + tid + ':read_by_uid'], next);
			},
			function(next) {
				db.sortedSetsRemove(['topics:tid', 'topics:recent', 'topics:posts', 'topics:views'], tid, next);
			},
			function(next) {
				deleteTopicFromCategoryAndUser(tid, next);
			},
			function(next) {
				Topics.deleteTopicTags(tid, next);
			},
			function(next) {
				reduceCounters(tid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:topic.delete', tid);
			db.delete('topic:' + tid, callback);
		});
	};

	function deleteTopicFromCategoryAndUser(tid, callback) {
		Topics.getTopicFields(tid, ['cid', 'uid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			db.sortedSetsRemove(['categories:' + topicData.cid + ':tid', 'uid:' + topicData.uid + ':topics'], tid, callback);
		});
	}

	function reduceCounters(tid, callback) {
		var incr = -1;
		async.parallel([
			function(next) {
				db.incrObjectFieldBy('global', 'topicCount', incr, next);
			},
			function(next) {
				Topics.getTopicFields(tid, ['cid', 'postcount'], function(err, topicData) {
					if (err) {
						return next(err);
					}
					topicData.postcount = parseInt(topicData.postcount, 10);
					topicData.postcount = topicData.postcount || 0;
					var postCountChange = incr * topicData.postcount;

					async.parallel([
						function(next) {
							db.incrObjectFieldBy('global', 'postCount', postCountChange, next);
						},
						function(next) {
							db.incrObjectFieldBy('category:' + topicData.cid, 'post_count', postCountChange, next);
						},
						function(next) {
							db.incrObjectFieldBy('category:' + topicData.cid, 'topic_count', incr, next);
						}
					], next);
				});
			}
		], callback);
	}
};
