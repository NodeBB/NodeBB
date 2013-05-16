var	RDB = require('./redis.js'),
	utils = require('./utils.js'),
	marked = require('marked'),
	user = require('./user.js'),
	topics = require('./topics.js'),
	config = require('../config.js');

marked.setOptions({
	breaks: true
});

(function(Posts) {

	Posts.get = function(callback, tid, current_user, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		var post_data, user_data, thread_data, vote_data, viewer_data;

		topics.markAsRead(tid, current_user);

		//compile thread after all data is asynchronously called
		function generateThread() {
			if (!post_data || !user_data || !thread_data || !vote_data || !viewer_data) return;

			var	posts = [],
				main_posts = [],
				manage_content = viewer_data.reputation >= config.privilege_thresholds.manage_content;


			for (var i=0, ii= post_data.pid.length; i<ii; i++) {
				var uid = post_data.uid[i],
					pid = post_data.pid[i];
					
				if (post_data.deleted[i] === null || (post_data.deleted[i] === '1' && manage_content)) {
					var post_obj = {
						'pid' : pid,
						'uid' : uid,
						'content' : marked(post_data.content[i] || ''),
						'post_rep' : post_data.reputation[i] || 0,
						'timestamp' : post_data.timestamp[i],
						'relativeTime': utils.relativeTime(post_data.timestamp[i]),
						'username' : user_data[uid].username || 'anonymous',
						'user_rep' : user_data[uid].reputation || 0,
						'gravatar' : user_data[uid].picture || 'http://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e',
						'fav_star_class' : vote_data[pid] ? 'icon-star' : 'icon-star-empty',
						'display_moderator_tools': (uid == current_user || manage_content) ? 'show' : 'none',
						'edited-class': post_data.editor[i] !== null ? '' : 'none',
						'editor': post_data.editor[i] !== null ? user_data[post_data.editor[i]].username : '',
						'relativeEditTime': post_data.editTime !== null ? utils.relativeTime(post_data.editTime[i]) : '',
						'deleted': post_data.deleted[i] || '0'
					};

					if (i == 0) main_posts.push(post_obj);
					else posts.push(post_obj);
				}
			}

			callback({
				'topic_name':thread_data.topic_name,
				'category_name':thread_data.category_name,
				'category_slug':thread_data.category_slug,
				'locked': parseInt(thread_data.locked) || 0,
				'deleted': parseInt(thread_data.deleted) || 0,
				'pinned': parseInt(thread_data.pinned) || 0,
				'topic_id': tid,
				'expose_tools': viewer_data.reputation >= config.privilege_thresholds.manage_thread ? 1 : 0,
				'posts': posts,
				'main_posts': main_posts
			});
		}


		// get all data for thread in asynchronous fashion
		RDB.lrange('tid:' + tid + ':posts', start, end, function(err, pids) {
			RDB.handle(err);
			
			var content = [], uid = [], timestamp = [], pid = [], post_rep = [], editor = [], editTime = [], deleted = [];

			for (var i=0, ii=pids.length; i<ii; i++) {
				content.push('pid:' + pids[i] + ':content');
				uid.push('pid:' + pids[i] + ':uid');
				timestamp.push('pid:' + pids[i] + ':timestamp');
				post_rep.push('pid:' + pids[i] + ':rep');
				editor.push('pid:' + pids[i] + ':editor');
				editTime.push('pid:' + pids[i] + ':edited');
				deleted.push('pid:' + pids[i] + ':deleted');
				pid.push(pids[i]);
			}

			Posts.getFavouritesByPostIDs(pids, current_user, function(fav_data) {
				vote_data = fav_data;
				generateThread();
			});

			RDB.multi()
				.mget(content)
				.mget(uid)
				.mget(timestamp)
				.mget(post_rep)
				.get('tid:' + tid + ':title')
				.get('tid:' + tid + ':locked')
				.get('tid:' + tid + ':category_name')
				.get('tid:' + tid + ':category_slug')
				.get('tid:' + tid + ':deleted')
				.get('tid:' + tid + ':pinned')
				.mget(editor)
				.mget(editTime)
				.mget(deleted)
				.exec(function(err, replies) {
					post_data = {
						pid: pids,
						content: replies[0],
						uid: replies[1],
						timestamp: replies[2],
						reputation: replies[3],
						editor: replies[10],
						editTime: replies[11],
						deleted: replies[12]
					};

					thread_data = {
						topic_name: replies[4],
						locked: replies[5] || 0,
						category_name: replies[6],
						category_slug: replies[7],
						deleted: replies[8] || 0,
						pinned: replies[9] || 0
					};

					// Add any editors to the user_data object
					for(var x=0,numPosts=replies[10].length;x<numPosts;x++) {
						if (replies[10][x] !== null && post_data.uid.indexOf(replies[10][x]) === -1) {
							post_data.uid.push(replies[10][x]);
						}
					}

					user.getMultipleUserFields(post_data.uid, ['username','reputation','picture'], function(user_details){
						user_data = user_details;
						generateThread();
					});
				});
		});

		user.getUserField(current_user, 'reputation', function(reputation){
			viewer_data = {
				reputation: reputation
			};
			generateThread();
		});
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
						RDB.set('tid:' + tid + ':recent:post', content);
						RDB.set('tid:' + tid + ':recent:author', data.username);

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
		RDB.mget(['pid:' + pid + ':tid', 'pid:' + pid + ':uid'], function(err, results) {
			var	tid = results[0],
				author = results[1],
				success = function() {
					RDB.set('pid:' + pid + ':content', content);
					RDB.set('pid:' + pid + ':edited', new Date().getTime());
					RDB.set('pid:' + pid + ':editor', uid);

					io.sockets.in('topic_' + tid).emit('event:post_edited', { pid: pid, content: marked(content || '') });
				};

			if (uid === author) success();
			else {
				user.getUserField(uid, 'reputation', function(reputation) {
					if (reputation >= config.privilege_thresholds.manage_content) success();
				});
			}
		});
	}

	Posts.delete = function(uid, pid) {
		RDB.mget(['pid:' + pid + ':tid', 'pid:' + pid + ':uid'], function(err, results) {
			var	tid = results[0],
				author = results[1],
				success = function() {
					RDB.set('pid:' + pid + ':deleted', 1);

					io.sockets.in('topic_' + tid).emit('event:post_deleted', { pid: pid });
				};

			if (uid === author) success();
			else {
				user.getUserField(uid, 'reputation', function(reputation) {
					if (reputation >= config.privilege_thresholds.manage_content) success();
				});
			}
		});
	}

	Posts.restore = function(uid, pid) {
		RDB.mget(['pid:' + pid + ':tid', 'pid:' + pid + ':uid'], function(err, results) {
			var	tid = results[0],
				author = results[1],
				success = function() {
					RDB.del('pid:' + pid + ':deleted');

					io.sockets.in('topic_' + tid).emit('event:post_restored', { pid: pid });
				};

			if (uid === author) success();
			else {
				user.getUserField(uid, 'reputation', function(reputation) {
					if (reputation >= config.privilege_thresholds.manage_content) success();
				});
			}
		});
	}
}(exports));