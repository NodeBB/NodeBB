var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./utils.js'),
	user = require('./user.js'),
	configs = require('../config.js'),
	categories = require('./categories.js');

(function(Topics) {

	Topics.get_by_category = function(callback, category, start, end) {

	}


	Topics.get = function(callback, category_id, current_user, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		//build a proper wrapper for this and move it into above function later
		var range_var = (category_id) ? 'categories:' + category_id + ':tid'  : 'topics:tid';

		RDB.smembers(range_var, function(err, tids) {
	

			var title = [],
				uid = [],
				timestamp = [],
				slug = [],
				postcount = [],
				locked = [],
				deleted = [],
				pinned = [],
				recent_post = [],
				recent_author = [];

			for (var i=0, ii=tids.length; i<ii; i++) {
				title.push('tid:' + tids[i] + ':title');
				uid.push('tid:' + tids[i] + ':uid');
				timestamp.push('tid:' + tids[i] + ':timestamp');
				slug.push('tid:' + tids[i] + ':slug');
				postcount.push('tid:' + tids[i] + ':postcount');
				locked.push('tid:' + tids[i] + ':locked');
				deleted.push('tid:' + tids[i] + ':deleted');
				pinned.push('tid:' + tids[i] + ':pinned');
				recent_post.push('tid:' + tids[i] + ':recent:post');
				recent_author.push('tid:' + tids[i] + ':recent:author');
			}

			var multi = RDB.multi()
				.get('cid:' + category_id + ':name')
				.smembers('cid:' + category_id + ':active_users');

			if (tids.length > 0) {
				multi
					.mget(title)
					.mget(uid)
					.mget(timestamp)
					.mget(slug)
					.mget(postcount)
					.mget(locked)
					.mget(deleted)
					.mget(pinned)
					.mget(recent_post)
					.mget(recent_author)
			}
				
			
			multi.exec(function(err, replies) {
				category_name = replies[0];

				if(category_id && category_name === null) {
					callback(false);
					return;
				}
				active_usernames = replies[1];
				var topics = [];

				if (tids.length > 0) {
					title = replies[2];
					uid = replies[3];
					timestamp = replies[4];
					slug = replies[5];
					postcount = replies[6];
					locked = replies[7];
					deleted = replies[8];
					pinned = replies[9];
					recent_post = replies[10];
					recent_author = replies[11];

					var usernames,
						has_read,
						moderators;

					function generate_topic() {
						if (!usernames || !has_read || !moderators) return;


						for (var i=0, ii=title.length; i<ii; i++) {			
							topics.push({
								'title' : title[i],
								'uid' : uid[i],
								'username': usernames[i],
								'timestamp' : timestamp[i],
								'relativeTime': utils.relativeTime(timestamp[i]),
								'slug' : slug[i],
								'post_count' : postcount[i],
								'lock-icon': locked[i] === '1' ? 'icon-lock' : 'none',
								'deleted': deleted[i],
								'pinned': parseInt(pinned[i] || 0),	// For sorting purposes
								'pin-icon': pinned[i] === '1' ? 'icon-pushpin' : 'none',
								'badgeclass' : (has_read[i] && current_user !=0) ? '' : 'badge-important',
								'recent_post' : recent_post[i],
								'recent_author' : recent_author[i]
							});
						}

						// Float pinned topics to the top
						topics = topics.sort(function(a, b) {
							if (a.pinned !== b.pinned) return b.pinned - a.pinned;
							else {
								// Sort by datetime descending
								return b.timestamp - a.timestamp;
							}
						});

						var active_users = [];
						for (var username in active_usernames) {
							active_users.push({'username': active_usernames[username]});
						}

						callback({
							'category_name' : category_id ? category_name : 'Recent',
							'show_topic_button' : category_id ? 'show' : 'hidden',
							'category_id': category_id || 0,
							'topics': topics,
							'active_users': active_users,
							'moderator_block_class': moderators.length > 0 ? '' : 'none',
							'moderators': moderators
						});
					}
					
					user.get_usernames_by_uids(uid, function(userNames) {
						usernames = userNames;
						generate_topic();
					});	

					Topics.hasReadTopics(tids, current_user, function(hasRead) {
						has_read = hasRead;
						generate_topic();
					});

					categories.getModerators(category_id, function(mods) {
						moderators = mods;
						generate_topic();
					})
				}
				else {
					callback({
						'category_name' : category_id ? category_name : 'Recent',
						'show_topic_button' : category_id ? 'show' : 'hidden',
						'category_id': category_id || 0,
						'topics': []
					});
				}
			});
		});
	}

	Topics.get_cid_by_tid = function(tid, callback) {
		RDB.get('tid:' + pid + ':cid', function(err, cid) {
			if (cid && parseInt(cid) > 0) callback(cid);
			else callback(false);
		});
	}

	Topics.markAsRead = function(tid, uid) {
		RDB.sadd('tid:' + tid + ':read_by_uid', uid);
	}

	Topics.hasReadTopics = function(tids, uid, callback) {
		var batch = RDB.multi();

		for (var i=0, ii=tids.length; i<ii; i++) {
			batch.sismember('tid:' + tids[i] + ':read_by_uid', uid);	
		}
		
		batch.exec(function(err, hasRead) {
			callback(hasRead);
		});
	}

	Topics.post = function(socket, uid, title, content, category_id) {
		if (!category_id) throw new Error('Attempted to post without a category_id');
		
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
		
		RDB.incr('global:next_topic_id', function(err, tid) {
			RDB.handle(err);

			// Global Topics
			if (uid == null) uid = 0;
			if (uid !== null) {
				RDB.sadd('topics:tid', tid);	
			} else {
				// need to add some unique key sent by client so we can update this with the real uid later
				RDB.lpush('topics:queued:tid', tid);
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

			Topics.markAsRead(tid, uid);

			// User Details - move this out later
			RDB.lpush('uid:' + uid + ':topics', tid);

			socket.emit('event:alert', {
				title: 'Thank you for posting',
				message: 'You have successfully posted. Click here to view your post.',
				type: 'notify',
				timeout: 2000
			});


			// in future it may be possible to add topics to several categories, so leaving the door open here.
			RDB.sadd('categories:' + category_id + ':tid', tid);
			RDB.set('tid:' + tid + ':cid', category_id);
			categories.get_category([category_id], function(data) {
				RDB.set('tid:' + tid + ':category_name', data.categories[0].name);
				RDB.set('tid:' + tid + ':category_slug', data.categories[0].slug);
			});

		});
	};

	Topics.lock = function(tid, uid, socket) {
		user.getUserField(uid, 'reputation', function(rep) {
			if (rep >= configs.privilege_thresholds.manage_thread) {
				// Mark thread as locked
				RDB.set('tid:' + tid + ':locked', 1);

				if (socket) {
					io.sockets.in('topic_' + tid).emit('event:topic_locked', {
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
				RDB.del('tid:' + tid + ':locked');

				if (socket) {
					io.sockets.in('topic_' + tid).emit('event:topic_unlocked', {
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
					io.sockets.in('topic_' + tid).emit('event:topic_deleted', {
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
				RDB.del('tid:' + tid + ':deleted');
				Topics.unlock(tid, uid);

				if (socket) {
					io.sockets.in('topic_' + tid).emit('event:topic_restored', {
						tid: tid,
						status: 'ok'
					});
				}
			}
		});
	}

	Topics.pin = function(tid, uid, socket) {
		user.getUserField(uid, 'reputation', function(rep) {
			if (rep >= configs.privilege_thresholds.manage_thread) {
				// Mark thread as deleted
				RDB.set('tid:' + tid + ':pinned', 1);

				if (socket) {
					io.sockets.in('topic_' + tid).emit('event:topic_pinned', {
						tid: tid,
						status: 'ok'
					});
				}
			}
		});
	}

	Topics.unpin = function(tid, uid, socket) {
		user.getUserField(uid, 'reputation', function(rep) {
			if (rep >= configs.privilege_thresholds.manage_thread) {
				// Mark thread as deleted
				RDB.del('tid:' + tid + ':pinned');

				if (socket) {
					io.sockets.in('topic_' + tid).emit('event:topic_unpinned', {
						tid: tid,
						status: 'ok'
					});
				}
			}
		});
	}

	Topics.move = function(tid, cid, socket) {
		RDB.get('tid:' + tid + ':cid', function(err, oldCid) {
			RDB.handle(err);

			RDB.smove('categories:' + oldCid + ':tid', 'categories:' + cid + ':tid', tid, function(err, result) {
				if (!err && result === 1) {
					RDB.set('tid:' + tid + ':cid', cid);
					categories.get_category([cid], function(data) {
						RDB.set('tid:' + tid + ':category_name', data.categories[0].name);
						RDB.set('tid:' + tid + ':category_slug', data.categories[0].slug);
					});
					socket.emit('api:topic.move', { status: 'ok' });
					io.sockets.in('topic_' + tid).emit('event:topic_moved', { tid: tid });
				} else {
					socket.emit('api:topic.move', { status: 'error' });
				}
			});
		});
	}
}(exports));