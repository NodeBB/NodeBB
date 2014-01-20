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
	events = require('./events');


(function(ThreadTools) {

	ThreadTools.exists = function(tid, callback) {

		db.isSetMember('topics:tid', tid, function(err, ismember) {

			if (err) {
				callback(false);
			}

			callback(ismember);
		});
	}

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
						if (err) return next(null, false);
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
	}

	ThreadTools.delete = function(tid, uid, callback) {
		topics.delete(tid);

		db.decrObjectField('global', 'topicCount');

		ThreadTools.lock(tid);

		db.searchRemove('topic', tid);

		events.logTopicDelete(uid, tid);

		websockets.emitTopicPostStats();

		websockets.in('topic_' + tid).emit('event:topic_deleted', {
			tid: tid
		});

		if (callback) {
			callback(null, {
				tid: tid
			});
		}
	}

	ThreadTools.restore = function(tid, uid, callback) {
		topics.restore(tid);
		db.incrObjectField('global', 'topicCount');
		ThreadTools.unlock(tid);

		events.logTopicRestore(uid, tid);

		websockets.emitTopicPostStats();

		websockets.in('topic_' + tid).emit('event:topic_restored', {
			tid: tid
		});

		topics.getTopicField(tid, 'title', function(err, title) {
			db.searchIndex('topic', title, tid);
		});

		if(callback) {
			callback(null, {
				tid:tid
			});
		}
	}

	ThreadTools.lock = function(tid, uid, callback) {
		topics.setTopicField(tid, 'locked', 1);

		websockets.in('topic_' + tid).emit('event:topic_locked', {
			tid: tid
		});

		if (callback) {
			callback(null, {
				tid: tid
			});
		}
	}

	ThreadTools.unlock = function(tid, uid, callback) {
		topics.setTopicField(tid, 'locked', 0);

		websockets.in('topic_' + tid).emit('event:topic_unlocked', {
			tid: tid
		});

		if (callback) {
			callback(null, {
				tid: tid
			});
		}
	}

	ThreadTools.pin = function(tid, uid, callback) {
		topics.setTopicField(tid, 'pinned', 1);
		topics.getTopicField(tid, 'cid', function(err, cid) {
			db.sortedSetAdd('categories:' + cid + ':tid', Math.pow(2, 53), tid);
		});

		websockets.in('topic_' + tid).emit('event:topic_pinned', {
			tid: tid
		});

		if (callback) {
			callback(null, {
				tid: tid
			});
		}
	}

	ThreadTools.unpin = function(tid, uid, callback) {
		topics.setTopicField(tid, 'pinned', 0);
		topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
			db.sortedSetAdd('categories:' + topicData.cid + ':tid', topicData.lastposttime, tid);
		});

		websockets.in('topic_' + tid).emit('event:topic_unpinned', {
			tid: tid
		});

		if (callback) {
			callback(null, {
				tid: tid
			});
		}
	}

	ThreadTools.move = function(tid, cid, callback) {
		topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
			var oldCid = topicData.cid;

			db.sortedSetRemove('categories:' + oldCid + ':tid', tid, function(err, result) {
				db.sortedSetAdd('categories:' + cid + ':tid', topicData.lastposttime, tid, function(err, result) {

					if(err) {
						return callback(err);
					}

					topics.setTopicField(tid, 'cid', cid);

					categories.moveRecentReplies(tid, oldCid, cid, function(err, data) {
						if (err) {
							winston.err(err);
						}
					});

					categories.moveActiveUsers(tid, oldCid, cid);

					categories.incrementCategoryFieldBy(oldCid, 'topic_count', -1);
					categories.incrementCategoryFieldBy(cid, 'topic_count', 1);

					callback(null);
				});
			});
		});
	}

	ThreadTools.isFollowing = function(tid, uid, callback) {
		db.isSetMember('tid:' + tid + ':followers', uid, callback);
	}

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
	}

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
	}

	ThreadTools.notifyFollowers = function(tid, exceptUid) {
		async.parallel([
			function(next) {
				topics.getTopicField(tid, 'title', function(err, title) {
					topics.getTeaser(tid, function(err, teaser) {
						if (!err) {
							notifications.create('<strong>' + teaser.username + '</strong> has posted a reply to: "<strong>' + title + '</strong>"', nconf.get('relative_path') + '/topic/' + tid, 'topic:' + tid, function(nid) {
								next(null, nid);
							});
						} else next(err);
					});
				});
			},
			function(next) {
				ThreadTools.getFollowers(tid, function(err, followers) {
					exceptUid = parseInt(exceptUid, 10);
					if (followers.indexOf(exceptUid) !== -1) followers.splice(followers.indexOf(exceptUid), 1);
					next(null, followers);
				});
			}
		], function(err, results) {
			if (!err) {
				notifications.push(results[0], results[1]);
			}
		});
	}

	ThreadTools.getLatestUndeletedPost = function(tid, callback) {
		ThreadTools.getLatestUndeletedPid(tid, function(err, pid) {
			if(err) {
				return callback(err);
			}

			posts.getPostData(pid, callback);
		});
	}

	ThreadTools.getLatestUndeletedPid = function(tid, callback) {
		db.getSortedSetRevRange('tid:' + tid + ':posts', 0, -1, function(err, pids) {
			if(err) {
				return callback(err);
			}
			if (pids.length === 0) {
				return callback(new Error('no-undeleted-pids-found'));
			}

			async.detectSeries(pids, function(pid, next) {
				posts.getPostField(pid, 'deleted', function(err, deleted) {
					next(parseInt(deleted, 10) === 0);
				});
			}, function(pid) {
				if (pid) {
					callback(null, pid);
				} else {
					callback(new Error('no-undeleted-pids-found'));
				}
			});
		});
	}
}(exports));