'use strict';

var async = require('async'),

	db = require('./database'),
	topics = require('./topics'),
	categories = require('./categories'),
	posts = require('./posts'),
	plugins = require('./plugins'),
	batch = require('./batch'),
	privileges = require('./privileges');


(function(ThreadTools) {

	ThreadTools.delete = function(tid, uid, callback) {
		toggleDelete(tid, uid, true, callback);
	};

	ThreadTools.restore = function(tid, uid, callback) {
		toggleDelete(tid, uid, false, callback);
	};

	function toggleDelete(tid, uid, isDelete, callback) {
		var topicData;
		async.waterfall([
			function (next) {
				privileges.topics.isOwnerOrAdminOrMod(tid, uid, next);
			},
			function (isOwnerOrAdminOrMod, next) {
				if (!isOwnerOrAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}
				topics.getTopicFields(tid, ['tid', 'cid', 'uid', 'deleted', 'title', 'mainPid'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;

				if (parseInt(topicData.deleted, 10) === 1 && isDelete) {
					return callback(new Error('[[error:topic-already-deleted]]'));
				} else if(parseInt(topicData.deleted, 10) !== 1 && !isDelete) {
					return callback(new Error('[[error:topic-already-restored]]'));
				}

				topics[isDelete ? 'delete' : 'restore'](tid, next);
			},
			function (next) {
				topicData.deleted = isDelete ? 1 : 0;

				if (isDelete) {
					plugins.fireHook('action:topic.delete', topicData);
				} else {
					plugins.fireHook('action:topic.restore', topicData);
				}

				var data = {
					tid: tid,
					cid: topicData.cid,
					isDelete: isDelete,
					uid: uid
				};

				callback(null, data);
			}
		], callback);
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
				privileges.topics.isOwnerOrAdminOrMod(tid, uid, next);
			},
			function (isOwnerOrAdminOrMod, next) {
				if (!isOwnerOrAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				topics.getTopicFields(tid, ['mainPid', 'cid'], next);
			},
			function (_topic, next) {
				topic = _topic;

				batch.processSortedSet('tid:' + tid + ':posts', function(pids, next) {
					async.eachLimit(pids, 10, posts.purge, next);
				}, {alwaysStartAt: 0}, next);
			},
			function (next) {
				posts.purge(topic.mainPid, next);
			},
			function (next) {
				topics.purge(tid, next);
			},
			function (next) {
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

		var cid;

		async.waterfall([
			function (next) {
				topics.getTopicField(tid, 'cid', next);
			},
			function (_cid, next) {
				cid = _cid;
				if (!cid) {
					return next(new Error('[[error:no-topic]]'));
				}
				privileges.categories.isAdminOrMod(cid, uid, next);
			},
			function (isAdminOrMod, next) {
				if (!isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				topics.setTopicField(tid, 'locked', lock ? 1 : 0, next);
			},
			function (next) {
				var data = {
					tid: tid,
					isLocked: lock,
					uid: uid,
					cid: cid
				};

				plugins.fireHook('action:topic.lock', data);

				next(null, data);
			}
		], callback);
	}

	ThreadTools.pin = function(tid, uid, callback) {
		togglePin(tid, uid, true, callback);
	};

	ThreadTools.unpin = function(tid, uid, callback) {
		togglePin(tid, uid, false, callback);
	};

	function togglePin(tid, uid, pin, callback) {
		var topicData;
		async.waterfall([
			function (next) {
				topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return callback();
				}
				topics.getTopicFields(tid, ['cid', 'lastposttime'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				privileges.categories.isAdminOrMod(_topicData.cid, uid, next);
			},
			function(isAdminOrMod, next) {
				if (!isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}
				async.parallel([
					async.apply(topics.setTopicField, tid, 'pinned', pin ? 1 : 0),
					async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids', pin ? Math.pow(2, 53) : topicData.lastposttime, tid)
				], next);
			},
			function(results, next) {
				var data = {
					tid: tid,
					isPinned: pin,
					uid: uid,
					cid: topicData.cid
				};

				plugins.fireHook('action:topic.pin', data);

				next(null, data);
			}
		], callback);
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
			categories.moveRecentReplies(tid, oldCid, cid);

			async.parallel([
				function (next) {
					categories.incrementCategoryFieldBy(oldCid, 'topic_count', -1, next);
				},
				function (next) {
					categories.incrementCategoryFieldBy(cid, 'topic_count', 1, next);
				},
				function (next) {
					topics.setTopicField(tid, 'cid', cid, next);
				}
			], function(err) {
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
