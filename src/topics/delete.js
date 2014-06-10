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
				db.sortedSetRemove('topics:recent', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:posts', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:views', tid, next);
			},
			function(next) {
				Topics.getTopicField(tid, 'cid', function(err, cid) {
					if(err) {
						return next(err);
					}
					db.incrObjectFieldBy('category:' + cid, 'topic_count', -1, next);
				});
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			Topics.updateTopicCount(callback);
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
					db.sortedSetAdd('topics:recent', topicData.lastposttime, tid, next);
				},
				function(next) {
					db.sortedSetAdd('topics:posts', topicData.postcount, tid, next);
				},
				function(next) {
					db.sortedSetAdd('topics:views', topicData.viewcount, tid, next);
				},
				function(next) {
					Topics.getTopicField(tid, 'cid', function(err, cid) {
						if(err) {
							return next(err);
						}
						db.incrObjectFieldBy('category:' + cid, 'topic_count', 1, next);
					});
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				Topics.updateTopicCount(callback);
			});
		});
	};

	Topics.purge = function(tid, callback) {
		async.parallel([
			function(next) {
				db.delete('tid:' + tid + ':followers', next);
			},
			function(next) {
				db.delete('tid:' + tid + ':read_by_uid', next);
			},
			function(next) {
				db.sortedSetRemove('topics:tid', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:recent', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:posts', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:views', tid, next);
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

			async.parallel([
				function(next) {
					db.sortedSetRemove('categories:' + topicData.cid + ':tid', tid, next);
				},
				function(next) {
					db.sortedSetRemove('uid:' + topicData.uid + ':topics', tid, next);
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				if (parseInt(topicData.deleted, 10) === 0) {
					async.parallel([
						function(next) {
							db.decrObjectField('category:' + topicData.cid, 'topic_count', next);
						},
						function(next) {
							db.decrObjectField('global', 'topicCount', callback);
						}
					], callback);
				} else {
					callback();
				}
			});
		});
	}
};
