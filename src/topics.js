var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./utils.js'),
	user = require('./user.js'),
	configs = require('../config.js');

(function(Topics) {

	Topics.get_by_category = function(callback, category, start, end) {

	}



	Topics.get = function(callback, category_id, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		//build a proper wrapper for this and move it into above function later
		var range_var = (category_id) ? 'categories:' + category_id + ':tid'  : 'topics:tid';

		RDB.lrange(range_var, start, end, function(tids) {
			var title = [],
				uid = [],
				timestamp = [],
				slug = [],
				postcount = [];

			for (var i=0, ii=tids.length; i<ii; i++) {
				title.push('tid:' + tids[i] + ':title');
				uid.push('tid:' + tids[i] + ':uid');
				timestamp.push('tid:' + tids[i] + ':timestamp');
				slug.push('tid:' + tids[i] + ':slug');
				postcount.push('tid:' + tids[i] + ':postcount');
			}

			if (tids.length > 0) {
				RDB.multi()
					.mget(title)
					.mget(uid)
					.mget(timestamp)
					.mget(slug)
					.mget(postcount)
					.exec(function(err, replies) {
						
						title = replies[0];
						uid = replies[1];
						timestamp = replies[2];
						slug = replies[3];
						postcount = replies[4];
						
						
						
						user.get_usernames_by_uids(uid, function(userNames) {
							var topics = [];
							
							for (var i=0, ii=title.length; i<ii; i++) {
								
								topics.push({
									'title' : title[i],
									'uid' : uid[i],
									'username': userNames[i],
									'timestamp' : timestamp[i],
									'relativeTime': utils.relativeTime(timestamp[i]),
									'slug' : slug[i],
									'post_count' : postcount[i]
								});
							}
						
							callback({'category_id': category_id, 'topics': topics});
						});

						
					}
				);
			} else callback({'category_id': category_id, 'topics': []});
		});
	}

	Topics.post = function(socket, uid, title, content, category_id) {
		
		if (uid === 0) {
			socket.emit('event:alert', {
				title: 'Thank you for posting',
				message: 'Since you are unregistered, your post is awaiting approval. Click here to register now.',
				type: 'warning',
				timeout: 7500,
				clickfn: function() {
					ajaxify.go('register');
				}
			});
			return; // for now, until anon code is written.
		}
		
		RDB.incr('global:next_topic_id', function(tid) {

			// Global Topics
			if (uid == null) uid = 0;
			if (uid !== null) {
				RDB.lpush('topics:tid', tid);	
			} else {
				// need to add some unique key sent by client so we can update this with the real uid later
				RDB.lpush('topics:queued:tid', tid);		
			}
			


			if (category_id) {
				RDB.lpush('categories:' + category_id + ':tid', tid);
			}

			var slug = tid + '/' + utils.slugify(title);

			// Topic Info
			RDB.set('tid:' + tid + ':title', title);
			RDB.set('tid:' + tid + ':uid', uid);
			RDB.set('tid:' + tid + ':slug', slug);
			RDB.set('tid:' + tid + ':timestamp', new Date().getTime());
		
			
			RDB.set('topic:slug:' + slug + ':tid', tid);

			// Posts
			posts.create(uid, tid, content, function(pid) {
				if (pid > 0) RDB.lpush('tid:' + tid + ':posts', pid);
			});


			// User Details - move this out later
			RDB.lpush('uid:' + uid + ':topics', tid);

			socket.emit('event:alert', {
				title: 'Thank you for posting',
				message: 'You have successfully posted. Click here to view your post.',
				type: 'notify',
				timeout: 2000
			});
		});
	};

	Topics.lock = function(tid, uid, socket) {
		user.getUserField(uid, 'reputation', function(rep) {
			if (rep >= configs.privilege_thresholds.manage_thread) {
				// Mark thread as locked
				RDB.set('tid:' + tid + ':locked', 1);

				if (socket) {
					socket.emit('event:topic_locked', {
						tid: tid,
						status: 'ok'
					});
				}
			}
		});
	}

	Topics.unlock = function(tid, uid, socket) {
		user.getUserField(uid, 'reputation', function(rep) {
			if (rep >= configs.privilege_thresholds.manage_thread) {
				// Mark thread as locked
				RDB.set('tid:' + tid + ':locked', 0);

				if (socket) {
					socket.emit('event:topic_unlocked', {
						tid: tid,
						status: 'ok'
					});
				}
			}
		});
	}

	Topics.delete = function(tid, uid, socket) {
		user.getUserField(uid, 'reputation', function(rep) {
			if (rep >= configs.privilege_thresholds.manage_thread) {
				// Mark thread as deleted
				RDB.set('tid:' + tid + ':deleted', 1);
				Topics.lock(tid, uid);

				if (socket) {
					socket.emit('event:topic_deleted', {
						tid: tid,
						status: 'ok'
					});
				}
			}
		});
	}

	Topics.restore = function(tid, uid, socket) {
		user.getUserField(uid, 'reputation', function(rep) {
			if (rep >= configs.privilege_thresholds.manage_thread) {
				// Mark thread as deleted
				RDB.set('tid:' + tid + ':deleted', 0);
				Topics.lock(tid, uid);

				if (socket) {
					socket.emit('event:topic_restored', {
						tid: tid,
						status: 'ok'
					});
				}
			}
		});
	}
}(exports));