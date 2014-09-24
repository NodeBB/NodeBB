'use strict';

var async = require('async'),
	db = require('../database'),

	plugins = require('../plugins');


module.exports = function(Topics) {

	function updateCounters(tid, incr, callback) {
		async.parallel([
			function(next) {
				db.incrObjectFieldBy('global', 'topicCount', incr, next);
			},
			function(next) {
				Topics.getTopicFields(tid, ['cid', 'postcount'], function(err, topicData) {
					if (err) {
						return next(err);
					}
					var postCountChange = incr * parseInt(topicData.postcount, 10);
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
		], function(err) {
			if (err) {
				return callback(err);
			}

			updateCounters(tid, -1, callback);
		});
	};

	Topics.restore = function(tid, callback) {
		Topics.getTopicFields(tid, ['lastposttime', 'postcount', 'viewcount'], function(err, topicData) {
			if(err) {
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
			], function(err) {
				if (err) {
					return callback(err);
				}

				updateCounters(tid, 1, callback);
			});
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
		Topics.getTopicFields(tid, ['cid', 'uid', 'deleted'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			db.sortedSetsRemove(['categories:' + topicData.cid + ':tid', 'uid:' + topicData.uid + ':topics'], tid, function(err) {
				if (err) {
					return callback(err);
				}

				if (parseInt(topicData.deleted, 10) === 0) {
					async.parallel([
						function(next) {
							db.decrObjectField('category:' + topicData.cid, 'topic_count', next);
						},
						function(next) {
							db.decrObjectField('global', 'topicCount', next);
						}
					], callback);
				} else {
					callback();
				}
			});
		});
	}
};
