'use strict';

var winston = require('winston'),
	nconf = require('nconf'),
	async = require('async'),

	db = require('./database'),
	topics = require('./topics'),
	categories = require('./categories'),
	CategoryTools = require('./categoryTools'),
	user = require('./user'),
	notifications = require('./notifications'),
	posts = require('./posts'),
	meta = require('./meta'),
	websockets = require('./socket.io'),
	events = require('./events'),
	Plugins = require('./plugins');


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

				Plugins.fireHook(isDelete ? 'action:topic.delete' : 'action:topic.restore', tid);

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

	ThreadTools.move = function(tid, cid, callback) {
		var topic;
		async.waterfall([
			function(next) {
				topics.getTopicFields(tid, ['cid', 'lastposttime', 'pinned', 'deleted'], next);
			},
			function(topicData, next) {
				topic = topicData;
				db.sortedSetRemove('categories:' + topicData.cid + ':tid', tid, next);
			},
			function(result, next) {
				var timestamp = parseInt(topic.pinned, 10) ? Math.pow(2, 53) : topic.lastposttime;
				db.sortedSetAdd('categories:' + cid + ':tid', timestamp, tid, next);
			}
		], function(err, result) {
			if(err) {
				return callback(err);
			}
			var oldCid = topic.cid;

			if(!parseInt(topic.deleted, 10)) {
				categories.incrementCategoryFieldBy(oldCid, 'topic_count', -1);
				categories.incrementCategoryFieldBy(cid, 'topic_count', 1);
			}

			categories.moveRecentReplies(tid, oldCid, cid);

			topics.setTopicField(tid, 'cid', cid, callback);
		});
	};

	ThreadTools.toggleFollow = function(tid, uid, callback) {
		topics.isFollowing(tid, uid, function(err, following) {
			if (err) {
				return callback(err);
			}

			db[following ? 'setRemove' : 'setAdd']('tid:' + tid + ':followers', uid, function(err) {
				if (typeof callback === 'function') {
					callback(err, !following);
				}
			});
		});
	};

}(exports));
