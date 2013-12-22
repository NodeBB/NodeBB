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
	websockets = require('./websockets'),
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
				view_deleted: results.categoryPrivs.view_deleted || results.hasEnoughRep
			});
		});
	}

	ThreadTools.lock = function(tid, socket) {
		topics.setTopicField(tid, 'locked', 1);

		if (socket) {
			websockets.in('topic_' + tid).emit('event:topic_locked', {
				tid: tid,
				status: 'ok'
			});

			if (socket) {
				socket.emit('api:topic.lock', {
					status: 'ok',
					tid: tid
				});
			}
		}
	}

	ThreadTools.unlock = function(tid, socket) {
		topics.setTopicField(tid, 'locked', 0);

		if (socket) {
			websockets.in('topic_' + tid).emit('event:topic_unlocked', {
				tid: tid,
				status: 'ok'
			});

			if (socket) {
				socket.emit('api:topic.unlock', {
					status: 'ok',
					tid: tid
				});
			}
		}
	}

	ThreadTools.delete = function(tid, callback) {
		topics.delete(tid);

		db.decrObjectField('global', 'topicCount');

		ThreadTools.lock(tid);

		db.searchRemove('topic', tid);

		events.logTopicDelete(uid, tid);

		websockets.in('topic_' + tid).emit('event:topic_deleted', {
			tid: tid,
			status: 'ok'
		});

		if (callback) {
			callback(null);
		}
	}

	ThreadTools.restore = function(tid, socket, callback) {
		topics.restore(tid);
		db.incrObjectField('global', 'topicCount');
		ThreadTools.unlock(tid);

		events.logTopicRestore(uid, tid);

		websockets.in('topic_' + tid).emit('event:topic_restored', {
			tid: tid,
			status: 'ok'
		});

		topics.getTopicField(tid, 'title', function(err, title) {
			db.searchIndex('topic', title, tid);
		});

		if(callback) {
			callback(null);
		}
	}

	ThreadTools.pin = function(tid, socket) {
		topics.setTopicField(tid, 'pinned', 1);
		topics.getTopicField(tid, 'cid', function(err, cid) {
			db.sortedSetAdd('categories:' + cid + ':tid', Math.pow(2, 53), tid);
		});

		if (socket) {
			websockets.in('topic_' + tid).emit('event:topic_pinned', {
				tid: tid,
				status: 'ok'
			});

			if (socket) {
				socket.emit('api:topic.pin', {
					status: 'ok',
					tid: tid
				});
			}
		}
	}

	ThreadTools.unpin = function(tid, socket) {
		topics.setTopicField(tid, 'pinned', 0);
		topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
			db.sortedSetAdd('categories:' + topicData.cid + ':tid', topicData.lastposttime, tid);
		});
		if (socket) {
			websockets.in('topic_' + tid).emit('event:topic_unpinned', {
				tid: tid,
				status: 'ok'
			});

			if (socket) {
				socket.emit('api:topic.unpin', {
					status: 'ok',
					tid: tid
				});
			}
		}
	}

	ThreadTools.move = function(tid, cid, socket) {

		topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
			var oldCid = topicData.cid;

			db.sortedSetRemove('categories:' + oldCid + ':tid', tid, function(err, result) {
				db.sortedSetAdd('categories:' + cid + ':tid', topicData.lastposttime, tid, function(err, result) {

					if(err) {
						socket.emit('api:topic.move', {
							status: 'error'
						});
						return;
					}

					topics.setTopicField(tid, 'cid', cid);

					categories.moveRecentReplies(tid, oldCid, cid, function(err, data) {
						if (err) {
							winston.err(err);
						}
					});

					categories.moveActiveUsers(tid, oldCid, cid, function(err, data) {
						if (err) {
							winston.err(err);
						}
					});

					categories.incrementCategoryFieldBy(oldCid, 'topic_count', -1);
					categories.incrementCategoryFieldBy(cid, 'topic_count', 1);

					socket.emit('api:topic.move', {
						status: 'ok'
					});

					websockets.in('topic_' + tid).emit('event:topic_moved', {
						tid: tid
					});
				});
			});
		});
	}

	ThreadTools.isFollowing = function(tid, current_user, callback) {
		db.isSetMember('tid:' + tid + ':followers', current_user, function(err, following) {
			callback(following);
		});
	}

	ThreadTools.toggleFollow = function(tid, current_user, callback) {
		ThreadTools.isFollowing(tid, current_user, function(following) {
			if (!following) {
				db.setAdd('tid:' + tid + ':followers', current_user, function(err, success) {
					if (callback) {
						if (!err) {
							callback({
								status: 'ok',
								follow: true
							});
						} else callback({
							status: 'error'
						});
					}
				});
			} else {
				db.setRemove('tid:' + tid + ':followers', current_user, function(err, success) {
					if (callback) {
						if (!err) {
							callback({
								status: 'ok',
								follow: false
							});
						} else callback({
							status: 'error'
						});
					}
				});
			}
		});
	}

	ThreadTools.getFollowers = function(tid, callback) {
		db.getSetMembers('tid:' + tid + ':followers', function(err, followers) {
			callback(err, followers.map(function(follower) {
				return parseInt(follower, 10);
			}));
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

	ThreadTools.getLatestUndeletedPid = function(tid, callback) {
		db.getListRange('tid:' + tid + ':posts', 0, -1, function(err, pids) {
			if (pids.length === 0) {
				return callback(new Error('no-undeleted-pids-found'));
			}

			pids.reverse();
			async.detectSeries(pids, function(pid, next) {
				posts.getPostField(pid, 'deleted', function(err, deleted) {
					if (parseInt(deleted, 10) === 0) {
						next(true);
					} else {
						next(false);
					}
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