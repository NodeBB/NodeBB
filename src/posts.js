var	RDB = require('./redis.js'),
	utils = require('./utils.js'),
	marked = require('marked'),
	user = require('./user.js');

(function(Posts) {

	Posts.get = function(callback, tid, current_user, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		var post_data, user_data, thread_data, vote_data;


		//compile thread after all data is asynchronously called
		function generateThread() {
			if (!post_data ||! user_data || !thread_data || !vote_data) return;

			var posts = [];

			for (var i=0, ii= post_data.pid.length; i<ii; i++) {
				var uid = post_data.uid[i],
					pid = post_data.pid[i];
					
				posts.push({
					'pid' : pid,
					'uid' : uid,
					'content' : marked(post_data.content[i] || ''),
					'post_rep' : post_data.reputation[i] || 0,
					'timestamp' : post_data.timestamp[i],
					'relativeTime': utils.relativeTime(post_data.timestamp[i]),
					'username' : user_data[uid].username || 'anonymous',
					'user_rep' : user_data[uid].reputation || 0,
					'gravatar' : user_data[uid].picture,
					'fav_star_class' : vote_data[pid] ? 'icon-star' : 'icon-star-empty',
					'display_moderator_tools' : uid === current_user ? 'show' : 'hide'
				});
			}

			callback({
				'topic_name':thread_data.topic_name,
				'locked': parseInt(thread_data.locked) || 0,
				'topic_id': tid,
				'posts': posts
			});
		}


		// get all data for thread in asynchronous fashion
		RDB.lrange('tid:' + tid + ':posts', start, end, function(pids) {
			var content = [], uid = [], timestamp = [], pid = [], post_rep = [];

			for (var i=0, ii=pids.length; i<ii; i++) {
				content.push('pid:' + pids[i] + ':content');
				uid.push('pid:' + pids[i] + ':uid');
				timestamp.push('pid:' + pids[i] + ':timestamp');
				post_rep.push('pid:' + pids[i] + ':rep');		
				pid.push(pids[i]);
			}

			RDB.get('tid:' + tid + ':title', function(topic_name) {
				thread_data = {topic_name: topic_name};
				generateThread();
			});

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
				.exec(function(err, replies) {
					post_data = {
						pid: pids,
						content: replies[0],
						uid: replies[1],
						timestamp: replies[2],
						reputation: replies[3]
					};

					thread_data = {
						topic_name: replies[4],
						locked: replies[5]
					};

					user.getMultipleUserFields(post_data.uid, ['username','reputation','picture'], function(user_details){
						user_data = user_details;
						generateThread();
					});
				});
			
		});
	}


	Posts.reply = function(socket, tid, uid, content) {
		Posts.create(uid, tid, content, function(pid) {
			if (pid > 0) {
				RDB.rpush('tid:' + tid + ':posts', pid);

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
								'fav_star_class' :'icon-star-empty' 
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
		
		RDB.get('tid:' + tid + ':locked', function(locked) {
			if (!locked || locked === '0') {
				RDB.incr('global:next_post_id', function(pid) {
					// Posts Info
					RDB.set('pid:' + pid + ':content', content);
					RDB.set('pid:' + pid + ':uid', uid);
					RDB.set('pid:' + pid + ':timestamp', new Date().getTime());
					RDB.set('pid:' + pid + ':rep', 0);
					
					RDB.incr('tid:' + tid + ':postcount');
					
					// User Details - move this out later
					RDB.lpush('uid:' + uid + ':posts', pid);
					
					RDB.db.hincrby(uid, 'postcount', 1);
					
					if (callback) 
						callback(pid);
				});
			} else {
				callback(-1);
			}
		});
	}


	Posts.favourite = function(io, pid, room_id, uid) {
		RDB.get('pid:' + pid + ':uid', function(uid_of_poster) {
			Posts.hasFavourited(pid, uid, function(hasFavourited) {
				if (hasFavourited == false) {
					RDB.sadd('pid:' + pid + ':users_favourited', uid);

					RDB.db.hincrby(String(uid_of_poster), 'reputation', 1);
					
					RDB.incr('pid:' + pid + ':rep');

					if (room_id) {
						io.sockets.in(room_id).emit('event:rep_up', {uid: uid_of_poster, pid: pid});
					}
				}
			});
		});
	}

	Posts.unfavourite = function(io, pid, room_id, uid) {
		RDB.get('pid:' + pid + ':uid', function(uid_of_poster) {
			Posts.hasFavourited(pid, uid, function(hasFavourited) {
				if (hasFavourited == true) {
					RDB.srem('pid:' + pid + ':users_favourited', uid);
					RDB.db.hincrby(String(uid_of_poster), 'reputation', -1);
					RDB.decr('pid:' + pid + ':rep');

					if (room_id) {
						io.sockets.in(room_id).emit('event:rep_down', {uid: uid_of_poster, pid: pid});
					}
				}
			});
		});
	}

	Posts.hasFavourited = function(pid, uid, callback) {
		RDB.sismember('pid:' + pid + ':users_favourited', uid, function(hasFavourited) {
			callback(hasFavourited);
		});
	}

	Posts.getFavouritesByPostIDs = function(pids, uid, callback) {
		var loaded = 0;
		var data = {};

		for (var i=0, ii=pids.length; i<ii; i++) {
			(function(post_id) {
				Posts.hasFavourited(post_id, uid, function(hasFavourited){
					data[post_id] = hasFavourited;
					loaded ++;
					if (loaded == pids.length) callback(data);
				});
			}(pids[i]))
		}
	}
}(exports));