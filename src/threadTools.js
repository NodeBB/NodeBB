'use strict';

var winston = require('winston'),
	nconf = require('nconf'),
	async = require('async'),

	db = require('./database'),
	topics = require('./topics'),
	categories = require('./categories'),
	user = require('./user'),
	notifications = require('./notifications'),
	posts = require('./posts'),
	meta = require('./meta'),
	websockets = require('./socket.io'),
	events = require('./events'),
	plugins = require('./plugins'),
	batch = require('./batch');


(function(ThreadTools) {

	ThreadTools.exists = function(tid, callback) {
		db.isSortedSetMember('topics:tid', tid, callback);
	};

	ThreadTools.delete = function(tid, uid, callback) {
		toggleDelete(tid, uid, true, callback);
	};

	ThreadTools.restore = function(tid, uid, callback) {
		toggleDelete(tid, uid, false, callback);
	};

	function toggleDelete(tid, uid, isDelete, callback) {
		topics.getTopicFields(tid, ['cid', 'deleted'], function(err, topicData) {
			if(err) {
				return callback(err);
			}

			var alreadyDeletedOrRestored = (parseInt(topicData.deleted, 10) && isDelete) || (!parseInt(topicData.deleted, 10) && !isDelete);
			if (alreadyDeletedOrRestored) {
				return callback(null, {tid: tid});
			}

			topics[isDelete ? 'delete' : 'restore'](tid, function(err) {
				function emitTo(room) {
					websockets.in(room).emit(isDelete ? 'event:topic_deleted' : 'event:topic_restored', {
						tid: tid,
						isDelete: isDelete
					});
				}
				if(err) {
					return callback(err);
				}

				ThreadTools[isDelete ? 'lock' : 'unlock'](tid);

				plugins.fireHook(isDelete ? 'action:topic.delete' : 'action:topic.restore', tid);

				events[isDelete ? 'logTopicDelete' : 'logTopicRestore'](uid, tid);

				websockets.emitTopicPostStats();

				emitTo('topic_' + tid);
				emitTo('category_' + topicData.cid);

				callback(null, {
					tid: tid
				});
			});
		});
	}

	ThreadTools.purge = function(tid, uid, callback) {
		batch.processSortedSet('tid:' + tid + ':posts', function(err, pids, next) {
			async.eachLimit(pids, 10, posts.purge, next);
		}, {alwaysStartAt: 0}, function(err) {
			if (err) {
				return callback(err);
			}

			topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
				if (err) {
					return callback(err);
				}
				posts.purge(mainPid, function(err) {
					if (err) {
						return callback(err);
					}
					topics.purge(tid, callback);
				});
			});
		});
	};

	ThreadTools.lock = function(tid, uid, callback) {
		toggleLock(tid, uid, true, callback);
	};

	ThreadTools.unlock = function(tid, uid, callback) {
		toggleLock(tid, uid, false, callback);
	};

	function toggleLock(tid, uid, lock, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			function emitTo(room) {
				websockets.in(room).emit(lock ? 'event:topic_locked' : 'event:topic_unlocked', {
					tid: tid,
					isLocked: lock
				});
			}

			if (err) {
				return callback(err);
			}

			topics.setTopicField(tid, 'locked', lock ? 1 : 0);

			plugins.fireHook('action:topic.lock', {
				tid: tid,
				isLocked: lock,
				uid: uid
			});

			emitTo('topic_' + tid);
			emitTo('category_' + cid);

			if (typeof callback === 'function') {
				callback(null, {
					tid: tid,
					isLocked: lock
				});
			}
		});
	}

	ThreadTools.pin = function(tid, uid, callback) {
		togglePin(tid, uid, true, callback);
	};

	ThreadTools.unpin = function(tid, uid, callback) {
		togglePin(tid, uid, false, callback);
	};

	function togglePin(tid, uid, pin, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			function emitTo(room) {
				websockets.in(room).emit(pin ? 'event:topic_pinned' : 'event:topic_unpinned', {
					tid: tid,
					isPinned: pin
				});
			}

			if (err) {
				return callback(err);
			}

			topics.setTopicField(tid, 'pinned', pin ? 1 : 0);
			topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
				db.sortedSetAdd('categories:' + topicData.cid + ':tid', pin ? Math.pow(2, 53) : topicData.lastposttime, tid);
			});

			plugins.fireHook('action:topic.pin', {
				tid: tid,
				isPinned: pin,
				uid: uid
			});

			emitTo('topic_' + tid);
			emitTo('category_' + cid);

			if (typeof callback === 'function') {
				callback(null, {
					tid: tid,
					isPinned: pin
				});
			}
		});
	}

	ThreadTools.move = function(tid, cid, uid, callback) {
		var topic;
		async.waterfall([
			function(next) {
				topics.getTopicFields(tid, ['cid', 'lastposttime', 'pinned', 'deleted'], next);
			},
			function(topicData, next) {
				topic = topicData;
				db.sortedSetRemove('categories:' + topicData.cid + ':tid', tid, next);
			},
			function(next) {
				var timestamp = parseInt(topic.pinned, 10) ? Math.pow(2, 53) : topic.lastposttime;
				db.sortedSetAdd('categories:' + cid + ':tid', timestamp, tid, next);
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

			topics.setTopicField(tid, 'cid', cid, callback);

			plugins.fireHook('action:topic.move', {
				tid: tid,
				fromCid: oldCid,
				toCid: cid,
				uid: uid
			});
		});
	};

	ThreadTools.toggleFollow = function(tid, uid, callback) {
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				ThreadTools.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				topics.isFollowing(tid, uid, next);
			},
			function (isFollowing, next) {
				db[isFollowing ? 'setRemove' : 'setAdd']('tid:' + tid + ':followers', uid, function(err) {
					next(err, !isFollowing);
				});
			}
		], callback);
	};

	ThreadTools.follow = function(tid, uid, callback) {
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				ThreadTools.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				db.setAdd('tid:' + tid + ':followers', uid, next);
			}
		], callback);
	};

}(exports));
