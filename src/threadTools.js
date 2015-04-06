'use strict';

var async = require('async'),

	db = require('./database'),
	topics = require('./topics'),
	categories = require('./categories'),
	posts = require('./posts'),
	plugins = require('./plugins'),
	batch = require('./batch');


(function(ThreadTools) {

	ThreadTools.delete = function(tid, uid, callback) {
		toggleDelete(tid, uid, true, callback);
	};

	ThreadTools.restore = function(tid, uid, callback) {
		toggleDelete(tid, uid, false, callback);
	};

	function toggleDelete(tid, uid, isDelete, callback) {
		topics.getTopicFields(tid, ['tid', 'cid', 'uid', 'deleted', 'title', 'mainPid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			var alreadyDeletedOrRestored = (parseInt(topicData.deleted, 10) && isDelete) || (!parseInt(topicData.deleted, 10) && !isDelete);
			if (alreadyDeletedOrRestored) {
				return callback(null, {tid: tid});
			}

			topics[isDelete ? 'delete' : 'restore'](tid, function(err) {
				if (err) {
					return callback(err);
				}

				ThreadTools[isDelete ? 'lock' : 'unlock'](tid, uid);
				if (isDelete) {
					plugins.fireHook('action:topic.delete', tid);
				} else {
					plugins.fireHook('action:topic.restore', topicData);
				}

				var data = {
					tid: tid,
					cid: topicData.cid,
					isDelete: isDelete,
					isLocked: isDelete,
					uid: uid
				};

				callback(null, data);
			});
		});
	}

	ThreadTools.purge = function(tid, uid, callback) {
		var topic;
		async.waterfall([
			function(next) {
				topics.exists(tid, next);
			},
			function(exists, next) {
				if (!exists) {
					return callback();
				}
				batch.processSortedSet('tid:' + tid + ':posts', function(pids, next) {
					async.eachLimit(pids, 10, posts.purge, next);
				}, {alwaysStartAt: 0}, next);
			},
			function(next) {
				topics.getTopicFields(tid, ['mainPid', 'cid'], next);
			},
			function(_topic, next) {
				topic = _topic;
				posts.purge(topic.mainPid, next);
			},
			function(next) {
				topics.purge(tid, next);
			},
			function(next) {
				next(null, {tid: tid, cid: topic.cid, uid: uid});
			}
		], callback);
	};

	ThreadTools.lock = function(tid, uid, callback) {
		toggleLock(tid, uid, true, callback);
	};

	ThreadTools.unlock = function(tid, uid, callback) {
		toggleLock(tid, uid, false, callback);
	};

	function toggleLock(tid, uid, lock, callback) {
		callback = callback || function() {};
		topics.getTopicField(tid, 'cid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			topics.setTopicField(tid, 'locked', lock ? 1 : 0);

			var data = {
				tid: tid,
				isLocked: lock,
				uid: uid,
				cid: cid
			};

			plugins.fireHook('action:topic.lock', data);

			callback(null, data);
		});
	}

	ThreadTools.pin = function(tid, uid, callback) {
		togglePin(tid, uid, true, callback);
	};

	ThreadTools.unpin = function(tid, uid, callback) {
		togglePin(tid, uid, false, callback);
	};

	function togglePin(tid, uid, pin, callback) {
		topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			topics.setTopicField(tid, 'pinned', pin ? 1 : 0);
			db.sortedSetAdd('cid:' + topicData.cid + ':tids', pin ? Math.pow(2, 53) : topicData.lastposttime, tid);

			var data = {
				tid: tid,
				isPinned: pin,
				uid: uid,
				cid: topicData.cid
			};

			plugins.fireHook('action:topic.pin', data);

			callback(null, data);
		});
	}

	ThreadTools.move = function(tid, cid, uid, callback) {
		var topic;
		async.waterfall([
			function(next) {
				topics.getTopicFields(tid, ['cid', 'lastposttime', 'pinned', 'deleted', 'postcount'], next);
			},
			function(topicData, next) {
				topic = topicData;
				db.sortedSetsRemove([
					'cid:' + topicData.cid + ':tids',
					'cid:' + topicData.cid + ':tids:posts'
				], tid, next);
			},
			function(next) {
				var timestamp = parseInt(topic.pinned, 10) ? Math.pow(2, 53) : topic.lastposttime;
				async.parallel([
					function(next) {
						db.sortedSetAdd('cid:' + cid + ':tids', timestamp, tid, next);
					},
					function(next) {
						topic.postcount = topic.postcount || 0;
						db.sortedSetAdd('cid:' + cid + ':tids:posts', topic.postcount, tid, next);
					}
				], next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			var oldCid = topic.cid;

			if(!parseInt(topic.deleted, 10)) {
				categories.incrementCategoryFieldBy(oldCid, 'topic_count', -1);
				categories.incrementCategoryFieldBy(cid, 'topic_count', 1);
			}

			categories.moveRecentReplies(tid, oldCid, cid);

			topics.setTopicField(tid, 'cid', cid, function(err) {
				if (err) {
					return callback(err);
				}
				plugins.fireHook('action:topic.move', {
					tid: tid,
					fromCid: oldCid,
					toCid: cid,
					uid: uid
				});
				callback();
			});
		});
	};


}(exports));
