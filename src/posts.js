var	RDB = require('./redis.js'),
	utils = require('./utils.js'),
	marked = require('marked'),
	user = require('./user.js');

(function(Posts) {
	//data structure
	//*global:next_post_id
	// *pid:1:content
	// *pid:1:uid
	// *pid:1:timestamp
	// ***pid:1:replies
	// *uid:1:posts



	Posts.get = function(callback, tid, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		RDB.get('tid:' + tid + ':title', function(topic_name) { //do these asynch later
			RDB.lrange('tid:' + tid + ':posts', start, end, function(pids) {
				var content = [],
					uid = [],
					timestamp = [],
					pid = [];

				for (var i=0, ii=pids.length; i<ii; i++) {
					content.push('pid:' + pids[i] + ':content');
					uid.push('pid:' + pids[i] + ':uid');
					timestamp.push('pid:' + pids[i] + ':timestamp');
					pid.push(pids[i]);
				}

				if (pids.length > 0) {
					RDB.multi()
						.mget(content)
						.mget(uid)
						.mget(timestamp)
						.exec(function(err, replies) {
							content = replies[0];
							uid = replies[1];
							timestamp = replies[2];

							user.get_usernames_by_uids(uid, function(userNames) {
								var posts = [];
								for (var i=0, ii=content.length; i<ii; i++) {
									posts.push({
										'pid' : pid[i],
										'content' : marked(content[i]),
										'uid' : uid[i],
										'userName' : userNames[i] || 'anonymous',
										'timestamp' : timestamp[i],
										'relativeTime': utils.relativeTime(timestamp[i])
									});
								}

								callback({'topic_name':topic_name, 'topic_id': tid, 'posts': posts});
							});
						});
				} else {
					callback({});
				}
			});
		});


	}


	Posts.reply = function(socket, tid, uid, content) {
		Posts.create(uid, content, function(pid) {
			RDB.rpush('tid:' + tid + ':posts', pid);

			socket.emit('event:alert', {
				title: 'Reply Successful',
				message: 'You have successfully replied. Click here to view your reply.',
				type: 'notify',
				timeout: 2000
			});
		});
	};

	Posts.create = function(uid, content, callback) {
		if (uid === null) return;
		
		RDB.incr('global:next_post_id', function(pid) {
			// Posts Info
			RDB.set('pid:' + pid + ':content', content);
			RDB.set('pid:' + pid + ':uid', uid);
			RDB.set('pid:' + pid + ':timestamp', new Date().getTime());
			
			// User Details - move this out later
			RDB.lpush('uid:' + uid + ':posts', pid);
			
			if (callback) callback(pid);
		});

	}

}(exports));