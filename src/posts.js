var	RDB = require('./redis.js'),
	utils = require('./../public/src/utils.js'),
	schema = require('./schema.js'),
	marked = require('marked'),
	user = require('./user.js'),
	topics = require('./topics.js'),
	favourites = require('./favourites.js'),
	threadTools = require('./threadTools.js'),
	feed = require('./feed.js'),
	async = require('async');

marked.setOptions({
	breaks: true
});

(function(Posts) {
	Posts.getPostsByTid = function(tid, current_user, start, end, callback) {
		RDB.lrange('tid:' + tid + ':posts', start, end, function(err, pids) {
			RDB.handle(err);
			topics.markAsRead(tid, current_user);

			if (pids.length) {
				Posts.getPostsByPids(pids, current_user, function(posts) {
					callback(posts);
				});
			} else {
				callback({
					error: 'no-posts'
				});
			}
		});
	}

	// todo, getPostsByPids has duplicated stuff, have that call this fn - after userinfo calls are pulled out.
	Posts.getPostSummaryByPids = function(pids, callback) {
		var content = [], uid = [], timestamp = [];
		for (var i=0, ii=pids.length; i<ii; i++) {
			content.push('pid:' + pids[i] + ':content');
			uid.push('pid:' + pids[i] + ':uid');
			timestamp.push('pid:' + pids[i] + ':timestamp');
		}

		RDB.multi()
			.mget(content)
			.mget(uid)
			.mget(timestamp)
			.exec(function(err, replies) {
				post_data = {
					pids: pids,
					content: replies[0],
					uid: replies[1],
					timestamp: replies[2]
				}

				// below, to be deprecated
				user.getMultipleUserFields(post_data.uid, ['username','reputation','picture'], function(user_details) {
					callback({
						users: user_details,
						posts: post_data
					});
				});
				// above, to be deprecated
			});
	};

	Posts.getPostsByPids = function(pids, current_user, callback) {
		var content = [], uid = [], timestamp = [], post_rep = [], editor = [], editTime = [], deleted = [];

		for (var i=0, ii=pids.length; i<ii; i++) {
			content.push('pid:' + pids[i] + ':content');
			uid.push('pid:' + pids[i] + ':uid');
			timestamp.push('pid:' + pids[i] + ':timestamp');
			post_rep.push('pid:' + pids[i] + ':rep');
			editor.push('pid:' + pids[i] + ':editor');
			editTime.push('pid:' + pids[i] + ':edited');
			deleted.push('pid:' + pids[i] + ':deleted');
		}


		function getFavouritesData(next) {
			favourites.getFavouritesByPostIDs(pids, current_user, function(fav_data) {
				next(null, fav_data);
			}); // to be moved
		}

		function getPostData(next) {
			RDB.multi()
				.mget(content)
				.mget(uid)
				.mget(timestamp)
				.mget(post_rep)
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
						editor: replies[4],
						editTime: replies[5],
						deleted: replies[6]
					};

					// below, to be deprecated
					// Add any editors to the user_data object
					for(var x = 0, numPosts = post_data.editor.length; x < numPosts; x++) {
						if (post_data.editor[x] !== null && post_data.uid.indexOf(post_data.editor[x]) === -1) {
							post_data.uid.push(post_data.editor[x]);
						}
					}

					user.getMultipleUserFields(post_data.uid, ['username', 'userslug', 'reputation', 'picture', 'signature'], function(user_details) {
						next(null, {
							users: user_details,
							posts: post_data
						});
					});
					// above, to be deprecated
				});
		}

		async.parallel([getFavouritesData, getPostData], function(err, results) {
			callback({
				'voteData' : results[0], // to be moved
				'userData' : results[1].users, // to be moved
				'postData' : results[1].posts
			});
		});
	}

	Posts.get_tid_by_pid = function(pid, callback) {
		RDB.get('pid:' + pid + ':tid', function(err, tid) {
			if (tid && parseInt(tid) > 0) {
				callback(tid);
			} else {
				callback(false);
			}
		});
	}

	Posts.get_cid_by_pid = function(pid, callback) {
		Posts.get_tid_by_pid(pid, function(tid) {
			if (tid) topics.get_cid_by_tid(tid, function(cid) {
				if (cid) {
					callback(cid);
				} else {
					callback(false);
				}
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


		user.getUserField(uid, 'lastposttime', function(lastposttime) {
			if(Date.now() - lastposttime < config.post_delay) {
				socket.emit('event:alert', {
					title: 'Too many posts!',
					message: 'You can only post every '+ (config.post_delay / 1000) + ' seconds.',
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
						
						RDB.zadd('categories:recent_posts:cid:' + cid, Date.now(), pid);
		  	  		
						topics.markAsRead(tid, uid);
					});


					socket.emit('event:alert', {
						title: 'Reply Successful',
						message: 'You have successfully replied. Click here to view your reply.',
						type: 'notify',
						timeout: 2000
					});

					// Send notifications to users who are following this topic
					threadTools.notify_followers(tid, uid);

					user.getUserFields(uid, ['username','reputation','picture','signature'], function(data) {

						var timestamp = Date.now();
						
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
									'signature' : marked(data.signature || ''),
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
		});
	};

	Posts.create = function(uid, tid, content, callback) {
		if (uid === null) return;
		
		RDB.get('tid:' + tid + ':locked', function(err, locked) {
			RDB.handle(err);

			if (!locked || locked === '0') {
				RDB.incr('global:next_post_id', function(err, pid) {
					RDB.handle(err);
					
					var timestamp = Date.now();
					// Posts Info
					RDB.set('pid:' + pid + ':content', content);
					RDB.set('pid:' + pid + ':uid', uid);
					RDB.set('pid:' + pid + ':timestamp', timestamp);
					RDB.set('pid:' + pid + ':rep', 0);
					RDB.set('pid:' + pid + ':tid', tid);
					
					RDB.incr('tid:' + tid + ':postcount');
					RDB.zadd(schema.topics().recent, timestamp, tid);
					RDB.set('tid:' + tid + ':lastposttime', timestamp);

					user.getUserFields(uid, ['username'], function(data) { // todo parallel
						//add active users to this category
						RDB.get('tid:' + tid + ':cid', function(err, cid) {
							RDB.handle(err);


							feed.updateTopic(tid, cid);

							// this is a bit of a naive implementation, defn something to look at post-MVP
							RDB.scard('cid:' + cid + ':active_users', function(amount) {
								if (amount > 10) {
									RDB.spop('cid:' + cid + ':active_users');
								}

								//RDB.sadd('cid:' + cid + ':active_users', data.username);
								RDB.sadd('cid:' + cid + ':active_users', uid);
							});
						});
					});
					
					
					// User Details - move this out later
					RDB.lpush('uid:' + uid + ':posts', pid);
					
					user.incrementUserFieldBy(uid, 'postcount', 1);
					user.setUserField(uid, 'lastposttime', timestamp);

					user.sendPostNotificationToFollowers(uid, tid, pid);

					if (callback) 
						callback(pid);
				});
			} else {
				callback(-1);
			}
		});
	}

	Posts.getRawContent = function(pid, callback) {
		RDB.get('pid:' + pid + ':content', function(err, raw) {
			callback(raw);
		});
	}

}(exports));