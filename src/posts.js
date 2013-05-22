var	RDB = require('./redis.js'),
	utils = require('./utils.js'),
	marked = require('marked'),
	user = require('./user.js'),
	topics = require('./topics.js'),
	config = require('../config.js'),
	async = require('async');

marked.setOptions({
	breaks: true
});

(function(Posts) {

	Posts.get = function(callback, pid, current_user) {
		// Not used... although Topics.get could be refactored to call Posts.get for every post
	}

	Posts.privileges = function(pid, uid, callback) {
		async.parallel([
			function(next) {
				Posts.get_tid_by_pid(pid, function(tid) {
					topics.privileges(tid, uid, function(privileges) {
						next(null, privileges);
					});
				});
			},
			function(next) {
				RDB.get('pid:' + pid + ':uid', function(err, author) {
					if (author && parseInt(author) > 0) next(null, author === uid);
				});
			},
			function(next) {
				user.getUserField(uid, 'reputation', function(reputation) {
					next(null, reputation >= config.privilege_thresholds.manage_content);
				});
			}
		], function(err, results) {
			callback({
				editable: results[0].editable || (results.slice(1).indexOf(true) !== -1 ? true : false),
				view_deleted: results[0].view_deleted || (results.slice(1).indexOf(true) !== -1 ? true : false)
			});
		});
	}

	Posts.get_tid_by_pid = function(pid, callback) {
		RDB.get('pid:' + pid + ':tid', function(err, tid) {
			if (tid && parseInt(tid) > 0) callback(tid);
			else callback(false);
		});
	}

	Posts.get_cid_by_pid = function(pid, callback) {
		Posts.get_tid_by_pid(pid, function(tid) {
			if (tid) topics.get_cid_by_tid(tid, function(cid) {
				if (cid) callback(cid);
				else callback(false);
			});
		})
	}

	Posts.reply = function(socket, tid, uid, content) {
		if (uid < 1) {
			socket.emit('event:alert', {
				title: 'Reply Unsuccessful',
				message: 'You don&apos;t seem to be logged in, so you cannot reply.',
				type: 'error',
				timeout: 2000
			});
			return;
		}

		Posts.create(uid, tid, content, function(pid) {
			if (pid > 0) {
				RDB.rpush('tid:' + tid + ':posts', pid);

				RDB.del('tid:' + tid + ':read_by_uid'); // let everybody know there is an unread post
				Posts.get_cid_by_pid(pid, function(cid) {
					RDB.del('cid:' + cid + ':read_by_uid');
				});

				// Re-add the poster, so he/she does not get an "unread" flag on this topic
				topics.markAsRead(tid, uid);

				socket.emit('event:alert', {
					title: 'Reply Successful',
					message: 'You have successfully replied. Click here to view your reply.',
					type: 'notify',
					timeout: 2000
				});

				user.getUserFields(uid, ['username','reputation','picture'], function(data){
					
					var timestamp = new Date().getTime();
					
					io.sockets.in('topic_' + tid).emit('event:new_post', {
						'posts' : [
							{
								'pid' : pid,
								'content' : marked(content || ''),
								'uid' : uid,
								'username' : data.username || 'anonymous',
								'user_rep' : data.reputation || 0,
								'post_rep' : 0,
								'gravatar' : data.picture,
								'timestamp' : timestamp,
								'relativeTime': utils.relativeTime(timestamp),
								'fav_star_class' :'icon-star-empty',
								'edited-class': 'none',
								'editor': '',
							}
						]
					});
				});
			} else {
				socket.emit('event:alert', {
					title: 'Reply Unsuccessful',
					message: 'Your reply could not be posted at this time. Please try again later.',
					type: 'notify',
					timeout: 2000
				});
			}
		});
	};

	Posts.create = function(uid, tid, content, callback) {
		if (uid === null) return;
		
		RDB.get('tid:' + tid + ':locked', function(err, locked) {
			RDB.handle(err);

			if (!locked || locked === '0') {
				RDB.incr('global:next_post_id', function(err, pid) {
					RDB.handle(err);
			
					// Posts Info
					RDB.set('pid:' + pid + ':content', content);
					RDB.set('pid:' + pid + ':uid', uid);
					RDB.set('pid:' + pid + ':timestamp', new Date().getTime());
					RDB.set('pid:' + pid + ':rep', 0);
					RDB.set('pid:' + pid + ':tid', tid);
					
					RDB.incr('tid:' + tid + ':postcount');


					user.getUserFields(uid, ['username'], function(data){
						//add active users to this category
						RDB.get('tid:' + tid + ':cid', function(err, cid) {
							RDB.handle(err);

							// this is a bit of a naive implementation, defn something to look at post-MVP
							RDB.scard('cid:' + cid + ':active_users', function(amount) {
								if (amount > 10) {
									RDB.spop('cid:' + cid + ':active_users');
								}

								RDB.sadd('cid:' + cid + ':active_users', data.username);
							});
						});
					});
					
					
					// User Details - move this out later
					RDB.lpush('uid:' + uid + ':posts', pid);
					
					user.incrementUserFieldBy(uid, 'postcount', 1);

					if (callback) 
						callback(pid);
				});
			} else {
				callback(-1);
			}
		});
	}


	Posts.favourite = function(pid, room_id, uid, socket) {
		if (uid === 0) {
			socket.emit('event:alert', {
				alert_id: 'post_favourite',
				title: 'Not Logged In',
				message: 'Please log in in order to favourite this post',
				type: 'error',
				timeout: 5000
			});

			socket.emit('api:posts.favourite', {
				status: 'error',
				pid: pid
			});
			return;
		}

		RDB.get('pid:' + pid + ':uid', function(err, uid_of_poster) {
			RDB.handle(err);

			Posts.hasFavourited(pid, uid, function(hasFavourited) {
				if (hasFavourited == false) {
					RDB.sadd('pid:' + pid + ':users_favourited', uid);
					RDB.incr('pid:' + pid + ':rep');

					if (uid !== uid_of_poster) user.incrementUserFieldBy(uid_of_poster, 'reputation', 1);

					if (room_id) {
						io.sockets.in(room_id).emit('event:rep_up', {uid: uid !== uid_of_poster ? uid_of_poster : 0, pid: pid});
					}

					socket.emit('api:posts.favourite', {
						status: 'ok'
					});
				}
			});
		});
	}

	Posts.unfavourite = function(pid, room_id, uid, socket) {
		if (uid === 0) {
			socket.emit('event:alert', {
				alert_id: 'post_favourite',
				title: 'Not Logged In',
				message: 'Please log in in order to favourite this post',
				type: 'error',
				timeout: 5000
			});
			return;
		}

		RDB.get('pid:' + pid + ':uid', function(err, uid_of_poster) {
			RDB.handle(err);

			Posts.hasFavourited(pid, uid, function(hasFavourited) {
				if (hasFavourited == true) {
					
					RDB.srem('pid:' + pid + ':users_favourited', uid);
					RDB.decr('pid:' + pid + ':rep');
					
					if (uid !== uid_of_poster) user.incrementUserFieldBy(uid_of_poster, 'reputation', -1);

					if (room_id) {
						io.sockets.in(room_id).emit('event:rep_down', {uid: uid !== uid_of_poster ? uid_of_poster : 0, pid: pid});
					}
				}
			});
		});
	}

	Posts.hasFavourited = function(pid, uid, callback) {
		RDB.sismember('pid:' + pid + ':users_favourited', uid, function(err, hasFavourited) {
			RDB.handle(err);
			
			callback(hasFavourited);
		});
	}

	Posts.getFavouritesByPostIDs = function(pids, uid, callback) {
		var loaded = 0;
		var data = {};

		for (var i=0, ii=pids.length; i<ii; i++) {
			(function(post_id) {
				Posts.hasFavourited(post_id, uid, function(hasFavourited) {
			
					data[post_id] = hasFavourited;
					loaded ++;
					if (loaded == pids.length) callback(data);
				});
			}(pids[i]))
		}
	}

	Posts.getRawContent = function(pid, socket) {
		RDB.get('pid:' + pid + ':content', function(err, raw) {
			socket.emit('api:posts.getRawPost', { post: raw });
		});
	}

	Posts.edit = function(uid, pid, content) {
		var	success = function() {
				RDB.set('pid:' + pid + ':content', content);
				RDB.set('pid:' + pid + ':edited', new Date().getTime());
				RDB.set('pid:' + pid + ':editor', uid);

				Posts.get_tid_by_pid(pid, function(tid) {
					io.sockets.in('topic_' + tid).emit('event:post_edited', { pid: pid, content: marked(content || '') });
				});
			};

		Posts.privileges(pid, uid, function(privileges) {
			if (privileges.editable) success();
		});
	}

	Posts.delete = function(uid, pid) {
		var	success = function() {
				RDB.set('pid:' + pid + ':deleted', 1);

				Posts.get_tid_by_pid(pid, function(tid) {
					io.sockets.in('topic_' + tid).emit('event:post_deleted', { pid: pid });
				});
			};

		Posts.privileges(pid, uid, function(privileges) {
			if (privileges.editable) success();
		});
	}

	Posts.restore = function(uid, pid) {
		var	success = function() {
				RDB.del('pid:' + pid + ':deleted');

				Posts.get_tid_by_pid(pid, function(tid) {
					io.sockets.in('topic_' + tid).emit('event:post_restored', { pid: pid });
				});
			};

		Posts.privileges(pid, uid, function(privileges) {
			if (privileges.editable) success();
		});
	}
}(exports));