var RDB = require('./redis.js'),
	topics = require('./topics.js'),
	categories = require('./categories.js'),
	user = require('./user.js'),
	async = require('async'),
	notifications = require('./notifications.js'),
	posts = require('./posts'),
	reds = require('reds'),
	topicSearch = reds.createSearch('nodebbtopicsearch'),
	winston = require('winston'),
	meta = require('./meta');

(function(ThreadTools) {

	ThreadTools.exists = function(tid, callback) {
		RDB.sismember('topics:tid', tid, function(err, ismember) {
			if (err) RDB.handle(err);
			callback( !! ismember || false);
		});
	}

	ThreadTools.privileges = function(tid, uid, callback) {
		//todo: break early if one condition is true

		function getCategoryPrivileges(next) {
			topics.getTopicField(tid, 'cid', function(err, cid) {
				categories.privileges(cid, uid, function(privileges) {
					next(null, privileges);
				});
			});
		}

		function hasEnoughRep(next) {
			user.getUserField(uid, 'reputation', function(err, reputation) {
				if (err) return next(null, false);
				next(null, reputation >= meta.config['privileges:manage_topic']);
			});
		}


		async.parallel([getCategoryPrivileges, hasEnoughRep], function(err, results) {
			callback({
				editable: results[0].editable || (results.slice(1).indexOf(true) !== -1 ? true : false),
				view_deleted: results[0].view_deleted || (results.slice(1).indexOf(true) !== -1 ? true : false)
			});
		});
	}

	ThreadTools.lock = function(tid, uid, socket) {
		ThreadTools.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {
				topics.setTopicField(tid, 'locked', 1);

				if (socket) {
					io.sockets. in ('topic_' + tid).emit('event:topic_locked', {
						tid: tid,
						status: 'ok'
					});

					socket.emit('api:topic.lock', {
						status: 'ok',
						tid: tid
					});
				}
			}
		});
	}

	ThreadTools.unlock = function(tid, uid, socket) {
		ThreadTools.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {
				topics.setTopicField(tid, 'locked', 0);

				if (socket) {
					io.sockets. in ('topic_' + tid).emit('event:topic_unlocked', {
						tid: tid,
						status: 'ok'
					});

					socket.emit('api:topic.unlock', {
						status: 'ok',
						tid: tid
					});
				}
			}
		});
	}

	ThreadTools.delete = function(tid, uid, callback) {
		ThreadTools.privileges(tid, uid, function(privileges) {
			if (privileges.editable || uid === -1) {

				topics.delete(tid);
				ThreadTools.lock(tid, uid);

				topicSearch.remove(tid);

				io.sockets. in ('topic_' + tid).emit('event:topic_deleted', {
					tid: tid,
					status: 'ok'
				});

				callback(null);
			} else callback(new Error('not-enough-privs'));
		});
	}

	ThreadTools.restore = function(tid, uid, socket) {
		ThreadTools.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {

				topics.restore(tid);
				ThreadTools.unlock(tid, uid);

				io.sockets. in ('topic_' + tid).emit('event:topic_restored', {
					tid: tid,
					status: 'ok'
				});

				if (socket) {
					socket.emit('api:topic.restore', {
						status: 'ok',
						tid: tid
					});
				}

				topics.getTopicField(tid, 'title', function(err, title) {
					topicSearch.index(title, tid);
				});
			}
		});
	}

	ThreadTools.pin = function(tid, uid, socket) {
		ThreadTools.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {

				topics.setTopicField(tid, 'pinned', 1);
				topics.getTopicField(tid, 'cid', function(err, cid) {
					RDB.zadd('categories:' + cid + ':tid', Math.pow(2, 53), tid);
				});

				if (socket) {
					io.sockets. in ('topic_' + tid).emit('event:topic_pinned', {
						tid: tid,
						status: 'ok'
					});

					socket.emit('api:topic.pin', {
						status: 'ok',
						tid: tid
					});
				}
			}
		});
	}

	ThreadTools.unpin = function(tid, uid, socket) {
		ThreadTools.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {

				topics.setTopicField(tid, 'pinned', 0);
				topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
					RDB.zadd('categories:' + topicData.cid + ':tid', topicData.lastposttime, tid);
				});
				if (socket) {
					io.sockets. in ('topic_' + tid).emit('event:topic_unpinned', {
						tid: tid,
						status: 'ok'
					});

					socket.emit('api:topic.unpin', {
						status: 'ok',
						tid: tid
					});
				}
			}
		});
	}

	ThreadTools.move = function(tid, cid, socket) {

		topics.getTopicFields(tid, ['cid', 'lastposttime'], function(err, topicData) {
			var oldCid = topicData.cid;
			var multi = RDB.multi();

			multi.zrem('categories:' + oldCid + ':tid', tid);
			multi.zadd('categories:' + cid + ':tid', topicData.lastposttime, tid);

			multi.exec(function(err, result) {

				if (!err && result[0] === 1 && result[1] === 1) {

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

					io.sockets. in ('topic_' + tid).emit('event:topic_moved', {
						tid: tid
					});
				} else {
					socket.emit('api:topic.move', {
						status: 'error'
					});
				}
			});
		});
	}

	ThreadTools.isFollowing = function(tid, current_user, callback) {
		RDB.sismember('tid:' + tid + ':followers', current_user, function(err, following) {
			callback(following);
		});
	}

	ThreadTools.toggleFollow = function(tid, current_user, callback) {
		ThreadTools.isFollowing(tid, current_user, function(following) {
			if (!following) {
				RDB.sadd('tid:' + tid + ':followers', current_user, function(err, success) {
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
				RDB.srem('tid:' + tid + ':followers', current_user, function(err, success) {
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

	ThreadTools.get_followers = function(tid, callback) {
		RDB.smembers('tid:' + tid + ':followers', function(err, followers) {
			callback(err, followers);
		});
	}

	ThreadTools.notify_followers = function(tid, exceptUid) {
		async.parallel([
			function(next) {

				topics.getTopicField(tid, 'title', function(err, title) {
					topics.getTeaser(tid, function(err, teaser) {
						if (!err) {
							notifications.create('<strong>' + teaser.username + '</strong> has posted a reply to: "<strong>' + title + '</strong>"', null, nconf.get('relative_path') + '/topic/' + tid, 'topic:' + tid, function(nid) {
								next(null, nid);
							});
						} else next(err);
					});
				});


			},
			function(next) {
				ThreadTools.get_followers(tid, function(err, followers) {
					if (followers.indexOf(exceptUid) !== -1) followers.splice(followers.indexOf(exceptUid), 1);
					next(null, followers);
				});
			}
		], function(err, results) {
			if (!err) notifications.push(results[0], results[1]);
			// Otherwise, do nothing
		});
	}

	ThreadTools.get_latest_undeleted_pid = function(tid, callback) {

		posts.getPostsByTid(tid, 0, -1, function(posts) {

			var numPosts = posts.length;
			if (!numPosts)
				return callback(new Error('no-undeleted-pids-found'));

			while (numPosts--) {
				if (posts[numPosts].deleted !== '1') {
					callback(null, posts[numPosts].pid);
					return;
				}
			}

			callback(new Error('no-undeleted-pids-found'));
		});
	}
}(exports));