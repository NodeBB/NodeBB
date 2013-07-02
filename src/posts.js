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

	Posts.getPostsByTid = function(tid, start, end, callback) {
		RDB.lrange('tid:' + tid + ':posts', start, end, function(err, pids) {
			
			RDB.handle(err);

			if (pids.length) {
				Posts.getPostsByPids(pids, function(posts) {
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

	Posts.getPostData = function(pid, callback) {
		RDB.hgetall('post:' + pid, function(err, data) {
			if(err === null) 
				callback(data);
			else
				console.log(err);
		});
	}

	Posts.getPostsByPids = function(pids, callback) {
		var posts = [], 
			loaded = 0;

		for(var i=0, ii=pids.length; i<ii; ++i) {
			(function(index, pid) {
				Posts.getPostData(pid, function(postData) {
					
					if(postData) {
						postData.relativeTime = utils.relativeTime(postData.timestamp);			
						posts[index] = postData;
					}
					
					++loaded;
					if(loaded === pids.length)
						callback(posts);
				});
			}(i, pids[i]));
		}
	}

	Posts.getPostField = function(pid, field, callback) {
		RDB.hget('post:' + pid, field, function(data) {
			if(err === null)
				callback(data);
			else
				console.log(err);
		});
	}


	Posts.get_cid_by_pid = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(tid) {
			if (tid) {
				topics.get_cid_by_tid(tid, function(cid) {
					if (cid) {
						callback(cid);
					} else {
						callback(false);
					}
				});
			}
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

					RDB.del('tid:' + tid + ':read_by_uid'); 

					Posts.get_cid_by_pid(pid, function(cid) {
						RDB.del('cid:' + cid + ':read_by_uid', function(err, data) {
							topics.markAsRead(tid, uid);	
						});
						
						RDB.zadd('categories:recent_posts:cid:' + cid, Date.now(), pid);
					});


					socket.emit('event:alert', {
						title: 'Reply Successful',
						message: 'You have successfully replied. Click here to view your reply.',
						type: 'notify',
						timeout: 2000
					});

					Posts.getTopicPostStats(socket);

					// Send notifications to users who are following this topic
					threadTools.notify_followers(tid, uid);

					user.getUserFields(uid, ['username','reputation','picture','signature'], function(data) {

						var timestamp = Date.now();
						var socketData = {
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
						};
						
						io.sockets.in('topic_' + tid).emit('event:new_post', socketData);
						io.sockets.in('recent_posts').emit('event:new_post', socketData);
						
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
		if (uid === null) {
			callback(-1);
			return;
		}
		
		topics.isLocked(tid, function(locked) {

			if (!locked || locked === '0') {
				RDB.incr('global:next_post_id', function(err, pid) {
					RDB.handle(err);
					
					var timestamp = Date.now();
					
					RDB.hmset('post:' + pid, {
						'pid': pid,
						'uid': uid,
						'tid': tid,
						'content': content,
						'timestamp': timestamp,
						'reputation': 0,
						'editor': '',
						'edited': 0,
						'deleted': 0
					});

					topics.increasePostCount(tid);
					topics.setTopicField(tid, 'lastposttime', timestamp);
					topics.addToRecent(tid, timestamp);

					RDB.incr('totalpostcount');
						
					RDB.get('tid:' + tid + ':cid', function(err, cid) {
						RDB.handle(err);

						feed.updateTopic(tid, cid);

						// this is a bit of a naive implementation, defn something to look at post-MVP
						RDB.scard('cid:' + cid + ':active_users', function(amount) {
							if (amount > 10) {
								RDB.spop('cid:' + cid + ':active_users');
							}

							RDB.sadd('cid:' + cid + ':active_users', uid);
						});
					});
					
					user.onNewPostMade(uid, tid, pid, timestamp);
					

					if (callback) 
						callback(pid);
				});
			} else {
				callback(-1);
			}
		});
	}
	
	Posts.getPostsByUid = function(uid, start, end, callback) {
		
		user.getPostIds(uid, start, end, function(pids) {
			
			if(pids && pids.length) {
			
				Posts.getPostsByPids(pids, function(posts) {
					callback(posts);
				});
			}
			else
				callback([]);
		});				
	}

	Posts.getTopicPostStats = function(socket) {
		RDB.mget(['totaltopiccount', 'totalpostcount'], function(err, data) {
			if(err === null) {
				var stats = {
					topics: data[0]?data[0]:0,
					posts: data[1]?data[1]:0				
				};
				
				socket.emit('post.stats', stats);
			}				
			else
				console.log(err);
		});
	}

}(exports));