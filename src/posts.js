var	RDB = require('./redis.js'),
	utils = require('./utils.js'),
	marked = require('marked'),
	user = require('./user.js'),
	async = require('async');

(function(Posts) {
	//data structure
	//*global:next_post_id
	// *pid:1:content
	// *pid:1:uid
	// *pid:1:timestamp
	// ***pid:1:replies
	// *uid:1:posts



	Posts.get = function(callback, tid, current_user, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		async.parallel({
			details: function(callback) {
				RDB.mget([
					'tid:' + tid + ':title',
					'tid:' + tid + ':locked'
				], function(results) {
					callback(null, {
						'topic_name': results[0],
						'locked': results[1]
					});
				});
			},
			posts: function(callback) {
				var participant_uids = [],
					post_calls = [];
				
				async.waterfall([
					function(next) {
						RDB.lrange('tid:' + tid + ':posts', start, end, function(pids) {
							var content = [],
								uids = [],
								participants = [],
								timestamp = [],
								pid = [],
								post_rep = [];

							for (var i=0, ii=pids.length; i<ii; i++) {
								content.push('pid:' + pids[i] + ':content');
								uids.push('pid:' + pids[i] + ':uid');
								timestamp.push('pid:' + pids[i] + ':timestamp');
								post_rep.push('pid:' + pids[i] + ':rep');		
								pid.push(pids[i]);
							}

							if (pids.length > 0) {
								RDB.multi()
									.mget(content)
									.mget(uids)
									.mget(timestamp)
									.mget(post_rep)
									.exec(function(err, replies) {
										// Populate uids array
										for(var x=0,numReplies=replies[1].length;x<numReplies;x++) {
											var uid = parseInt(replies[1][x]);
											if (participants.indexOf(uid) === -1) participants.push(uid);
										}

										// Construct return object
										next(null, {
											replies: replies,
											pids: pids,
											participants: participants
										});
									}
								);
							}
						});
					}, function(returnObj, next) {
						// Get user details
						var details = {},
							calls = [];

						for(var x=0,numParticipants=returnObj.participants.length;x<numParticipants;x++) {
							(function(uid) {
								calls.push(function(next) {
									// Get individual participant's details
									user.getUserData(uid, function(userData) {
										next(null, userData);
									})
								});
							})(returnObj.participants[x]);
						}
						async.parallel(calls, function(err, results) {
							for(var x=0,numResults=results.length;x<numResults;x++) {
								details[returnObj.participants[x]] = results[x];
							}
							returnObj.participants = details;
							next(null, returnObj);
						});
					}, function(returnObj, next) {
						// Favourited?
						var	calls = [],
							numPosts = returnObj.pids.length;

						for(var x=0;x<numPosts;x++) {
							(function(pid) {
								calls.push(function(callback) {
									Posts.hasFavourited(pid, current_user, function(hasFavourited) {
										callback(null, hasFavourited);
									});
								});
							})(returnObj.pids[x]);
						}
						async.parallel(calls, function(err, results) {
							returnObj.favourites = results;
							next(null, returnObj);
						});
					}
				], function(err, returnObj) {
					callback(null, returnObj);
				});
			}
		}, function(err, results) {
			// Construct posts array
			var posts = [],
				participant_details = results.posts.participants;
			for(var x=0,numPosts=results.posts.pids.length;x<numPosts;x++) {
				var uid = results.posts.replies[1][x],
					participant = participant_details[uid];
				posts.push({
					pid: results.posts.pids[x],
					content: marked(results.posts.replies[0][x] || ''),
					uid: uid,
					timestamp: results.posts.replies[2][x],
					relativeTime: utils.relativeTime(results.posts.replies[2][x]),
					post_rep: results.posts.replies[3][x],
					display_moderator_tools: results.posts.replies[1][x] === current_user ? 'show' : 'hide',
					username: participant.username,
					gravatar: participant.picture,
					user_rep: participant.reputation,
					fav_star_class: results.posts.favourites[x] ? 'icon-star' : 'icon-star-empty',
				});
			}

			// Construct return object
			callback({
				'topic_name': results.details.topic_name,
				'locked': parseInt(results.details.locked) || 0,
				'topic_id': tid,
				posts: posts,
				uids: results.posts.participants
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

					socket.in('topic_' + tid).emit('event:new_post', {
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
}(exports));