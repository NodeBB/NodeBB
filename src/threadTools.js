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

	ThreadTools.privileges = function(tid, uid, callback) {
		async.parallel({
			categoryPrivs: function(next) {
				topics.getTopicField(tid, 'cid', function(err, cid) {
					CategoryTools.privileges(cid, uid, next);
				});
			},
			hasEnoughRep: function(next) {
				if (parseInt(meta.config['privileges:disabled'], 10)) {
					return next(null, false);
				} else {
					user.getUserField(uid, 'reputation', function(err, reputation) {
						if (err) {
							return next(null, false);
						}
						next(null, parseInt(reputation, 10) >= parseInt(meta.config['privileges:manage_topic'], 10));
					});
				}
			}
		}, function(err, results) {
			callback(err, !results ? undefined : {
				read: results.categoryPrivs.read,
				write: results.categoryPrivs.write,
				editable: results.categoryPrivs.editable || results.hasEnoughRep,
				view_deleted: results.categoryPrivs.view_deleted || results.hasEnoughRep,
				moderator: results.categoryPrivs.moderator,
				admin: results.categoryPrivs.admin
			});
		});
	};

	ThreadTools.delete = function(tid, uid, callback) {
		toggleDelete(tid, uid, true, callback);
	};

	ThreadTools.restore = function(tid, uid, callback) {
		toggleDelete(tid, uid, false, callback);
	};

	function toggleDelete(tid, uid, isDelete, callback) {
		topics.getTopicField(tid, 'deleted', function(err, deleted) {
			if(err) {
				return callback(err);
			}

			if (parseInt(deleted, 10) && isDelete) {
				return callback(new Error('[[error:topic-already-deleted]]'));
			} else if (!parseInt(deleted, 10) && !isDelete) {
				return callback(new Error('[[error:topic-already-restored]]'));
			}

			topics[isDelete ? 'delete' : 'restore'](tid, function(err) {
				if(err) {
					return callback(err);
				}

				ThreadTools[isDelete ? 'lock' : 'unlock'](tid);

				Plugins.fireHook(isDelete ? 'action:topic.delete' : 'action:topic.restore', tid);

				events[isDelete ? 'logTopicDelete' : 'logTopicRestore'](uid, tid);

				websockets.emitTopicPostStats();

				websockets.in('topic_' + tid).emit(isDelete ? 'event:topic_deleted' : 'event:topic_restored', {
					tid: tid
				});

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
		topics.setTopicField(tid, 'locked', lock ? 1 : 0);

		websockets.in('topic_' + tid).emit(lock ? 'event:topic_locked' : 'event:topic_unlocked', {
			tid: tid
		});

		if (typeof callback === 'function') {
			callback(null, {
				tid: tid
			});
		}
	}

	ThreadTools.pin = function(tid, uid, callback) {
		togglePin(tid, uid, true, callback);
	};

	ThreadTools.unpin = function(tid, uid, callback) {
		togglePin(tid, uid, false, callback);
	};

	function togglePin(tid, uid, pin, callback) {
		topics.setTopicField(tid, 'pinned', pin ? 1 : 0);
		topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
			db.sortedSetAdd('categories:' + topicData.cid + ':tid', pin ? Math.pow(2, 53) : topicData.lastposttime, tid);
		});

		websockets.in('topic_' + tid).emit(pin ? 'event:topic_pinned' : 'event:topic_unpinned', {
			tid: tid
		});

		if (typeof callback === 'function') {
			callback(null, {
				tid: tid
			});
		}
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

			topics.setTopicField(tid, 'cid', cid);

			if(!parseInt(topic.deleted, 10)) {
				categories.incrementCategoryFieldBy(oldCid, 'topic_count', -1);
				categories.incrementCategoryFieldBy(cid, 'topic_count', 1);
			}

			categories.moveActiveUsers(tid, oldCid, cid);

			categories.moveRecentReplies(tid, oldCid, cid, callback);
		});
	};

	ThreadTools.isFollowing = function(tid, uid, callback) {
		db.isSetMember('tid:' + tid + ':followers', uid, callback);
	};

	ThreadTools.toggleFollow = function(tid, uid, callback) {
		ThreadTools.isFollowing(tid, uid, function(err, following) {
			if(err) {
				return callback(err);
			}

			db[following?'setRemove':'setAdd']('tid:' + tid + ':followers', uid, function(err, success) {
				if (callback) {
					if(err) {
						return callback(err);
					}

					callback(null, !following);
				}
			});
		});
	};

	ThreadTools.getFollowers = function(tid, callback) {
		db.getSetMembers('tid:' + tid + ':followers', function(err, followers) {
			if(err) {
				return callback(err);
			}

			if(followers) {
				followers = followers.map(function(follower) {
					return parseInt(follower, 10);
				});
			}
			callback(null, followers);
		});
	};

	ThreadTools.notifyFollowers = function(tid, pid, exceptUid) {
		async.parallel([
			function(next) {
				topics.getTopicFields(tid, ['title', 'slug'], function(err, topicData) {
					if(err) {
						return next(err);
					}

					user.getUserField(exceptUid, 'username', function(err, username) {
						if(err) {
							return next(err);
						}

						notifications.create({
							text: '[[notifications:user_posted_to, ' + username + ', ' + topicData.title + ']]',
							path: nconf.get('relative_path') + '/topic/' + topicData.slug + '#' + pid,
							uniqueId: 'topic:' + tid,
							from: exceptUid
						}, function(nid) {
							next(null, nid);
						});
					});
				});
			},
			function(next) {
				ThreadTools.getFollowers(tid, function(err, followers) {
					if(err) {
						return next(err);
					}

					exceptUid = parseInt(exceptUid, 10);
					if (followers.indexOf(exceptUid) !== -1) {
						followers.splice(followers.indexOf(exceptUid), 1);
					}

					next(null, followers);
				});
			}
		], function(err, results) {
			if (!err && results[1].length) {
				notifications.push(results[0], results[1]);
			}
		});
	};

	ThreadTools.getLatestUndeletedPost = function(tid, callback) {
		ThreadTools.getLatestUndeletedPid(tid, function(err, pid) {
			if(err) {
				return callback(err);
			}

			posts.getPostData(pid, callback);
		});
	};

	ThreadTools.getLatestUndeletedPid = function(tid, callback) {
		db.getSortedSetRevRange('tid:' + tid + ':posts', 0, -1, function(err, pids) {
			if(err) {
				return callback(err);
			}

			if (!pids.length) {
				return callback(null, null);
			}

			async.detectSeries(pids, function(pid, next) {
				posts.getPostField(pid, 'deleted', function(err, deleted) {
					next(parseInt(deleted, 10) === 0);
				});
			}, function(pid) {
				if (pid) {
					callback(null, pid);
				} else {
					callback(null, null);
				}
			});
		});
	};
}(exports));
