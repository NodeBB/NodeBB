var	RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./utils.js'),
	user = require('./user.js'),
	config = require('../config.js'),
	categories = require('./categories.js'),
	posts = require('./posts.js'),
	marked = require('marked'),
	async = require('async');

marked.setOptions({
	breaks: true
});

(function(Topics) {

	Topics.get_by_category = function(callback, category, start, end) {

	}


	Topics.get = function(callback, tid, current_user, start, end) {
		if (start == null) start = 0;
		if (end == null) end = -1;//start + 10;

		var post_data, user_data, thread_data, vote_data, privileges;

		getTopicPosts();

		getPrivileges();
		

		//compile thread after all data is asynchronously called
		function generateThread() {
			if (!post_data || !user_data || !thread_data || !vote_data || !privileges) return;

			var	retrieved_posts = [],
				main_posts = [];

			for (var i=0, ii= post_data.pid.length; i<ii; i++) {
				var uid = post_data.uid[i],
					pid = post_data.pid[i];
					
				if (post_data.deleted[i] === null || (post_data.deleted[i] === '1' && privileges.view_deleted) || current_user === uid) {
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
						'signature' : marked(user_data[uid].signature || ''),
						'fav_star_class' : vote_data[pid] ? 'icon-star' : 'icon-star-empty',
						'display_moderator_tools': (uid == current_user || privileges.editable) ? 'show' : 'none',
						'edited-class': post_data.editor[i] !== null ? '' : 'none',
						'editor': post_data.editor[i] !== null ? user_data[post_data.editor[i]].username : '',
						'relativeEditTime': post_data.editTime !== null ? utils.relativeTime(post_data.editTime[i]) : '',
						'deleted': post_data.deleted[i] || '0'
					};

					if (i == 0) main_posts.push(post_obj);
					else retrieved_posts.push(post_obj);
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
				'expose_tools': privileges.editable ? 1 : 0,
				'posts': retrieved_posts,
				'main_posts': main_posts
			});
		}

		function getTopicPosts() {
			// get all data for thread in asynchronous fashion
			RDB.lrange('tid:' + tid + ':posts', start, end, function(err, pids) {
				RDB.handle(err);
				
				if(pids.length === 0 ){
					callback(false);
					return;
				}
				
				Topics.markAsRead(tid, current_user);
				
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

				posts.getFavouritesByPostIDs(pids, current_user, function(fav_data) {
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

						user.getMultipleUserFields(post_data.uid, ['username','reputation','picture', 'signature'], function(user_details){
							user_data = user_details;
							generateThread();
						});
					});
			});
		}

		function getPrivileges() {
			Topics.privileges(tid, current_user, function(user_privs) {
				privileges = user_privs;
				generateThread();
			});
		}
	}

	Topics.privileges = function(tid, uid, callback) {
		async.parallel([
			function(next) {
				Topics.get_cid_by_tid(tid, function(cid) {
					categories.privileges(cid, uid, function(privileges) {
						next(null, privileges);
					});
				});
			},
			function(next) {
				user.getUserField(uid, 'reputation', function(reputation) {
					next(null, reputation >= config.privilege_thresholds.manage_thread);
				});
			}
		], function(err, results) {
			callback({
				editable: results[0].editable || (results.slice(1).indexOf(true) !== -1 ? true : false),
				view_deleted: results[0].view_deleted || (results.slice(1).indexOf(true) !== -1 ? true : false)
			});
		});
	}

	Topics.get_topic = function(tid, uid, callback) {
		var topicData = {};

		async.parallel([
			function(next) {
				RDB.mget([
					'tid:' + tid + ':title',
					'tid:' + tid + ':uid',
					'tid:' + tid + ':timestamp',
					'tid:' + tid + ':slug',
					'tid:' + tid + ':postcount',
					'tid:' + tid + ':locked',
					'tid:' + tid + ':pinned',
					'tid:' + tid + ':deleted'
				], function(err, topic) {
					topicData.title = topic[0];
					topicData.uid = topic[1];
					topicData.timestamp = topic[2];
					topicData.relativeTime = utils.relativeTime(topic[2]),
					topicData.slug = topic[3];
					topicData.post_count = topic[4];
					topicData.locked = topic[5];
					topicData.pinned = topic[6];
					topicData.deleted = topic[7];

					user.getUserField(topic[1], 'username', function(username) {
						topicData.username = username;
						next(null);
					})
				});
			},
			function(next) {
				if (uid && parseInt(uid) > 0) {
					RDB.sismember('tid:' + tid + ':read_by_uid', uid, function(err, read) {
						topicData.badgeclass = read ? '' : 'badge-important';
						next(null);
					});
				} else next(null);
			},
			function(next) {
				Topics.get_teaser(tid, function(teaser) {
					topicData.teaser_text = teaser.text;
					topicData.teaser_username = teaser.username;
					next(null);
				});
			}
		], function(err) {
			if (!err) {
				callback(topicData);
			}
		});
	}

	Topics.get_cid_by_tid = function(tid, callback) {
		RDB.get('tid:' + tid + ':cid', function(err, cid) {
			if (cid && parseInt(cid) > 0) callback(cid);
			else callback(false);
		});
	}

	Topics.markAsRead = function(tid, uid) {
		// there is an issue with this fn. if you read a topic that is previously read you will mark the category as read anyways - there is no check
		RDB.sadd('tid:' + tid + ':read_by_uid', uid);
		Topics.get_cid_by_tid(tid, function(cid) {
			RDB.sadd('cid:' + cid + ':read_by_uid', uid);
		});
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

	Topics.get_teasers = function(tids, callback) {
		var	requests = [];
		if (Array.isArray(tids)) {
			for(x=0,numTids=tids.length;x<numTids;x++) {
				(function(x) {
					requests.push(function(next) {
						Topics.get_teaser(tids[x], function(teaser_info) {
							next(null, teaser_info);
						});
					});
				})(x);
			}
			async.parallel(requests, function(err, teasers) {
				callback(teasers);
			});
		} else callback([]);
	}

	Topics.get_latest_undeleted_pid = function(tid, callback) {
		RDB.lrange('tid:' + tid + ':posts', 0, -1, function(err, pids) {
			var pidKeys = [],
				numPids = pids.length;

			if (numPids === 0) return callback(null);

			for(var x=0,numPids=pids.length;x<numPids;x++) {
				pidKeys.push('pid:' + pids[x] + ':deleted');
			}
			RDB.mget(pidKeys, function(err, posts) {
				var numPosts = posts.length;
				while(numPosts--) {
					if (posts[numPosts] !== '1') {
						callback(pids[numPosts]);
						break;
					}
				}
			});
		});
	}

	Topics.get_teaser = function(tid, callback) {
		Topics.get_latest_undeleted_pid(tid, function(pid) {
			if (pid !== null) {
				RDB.mget([
					'pid:' + pid + ':content',
					'pid:' + pid + ':uid'
				], function(err, content) {
					user.getUserField(content[1], 'username', function(username) {
						var stripped = content[0];
						if(content[0])
							stripped = utils.strip_tags(marked(content[0]));
						callback({
							"text": stripped,
							"username": username
						});
					});
				});
			}
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
				if (pid > 0) {
					RDB.lpush('tid:' + tid + ':posts', pid);

					// Notify any users looking at the category that a new post has arrived
					Topics.get_topic(tid, uid, function(topicData) {
						io.sockets.in('category_' + category_id).emit('event:new_topic', topicData);
					});
				}
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

			// let everyone know that there is an unread topic in this category
			RDB.del('cid:' + category_id + ':read_by_uid');

			// in future it may be possible to add topics to several categories, so leaving the door open here.
			RDB.sadd('categories:' + category_id + ':tid', tid);
			RDB.set('tid:' + tid + ':cid', category_id);
			categories.get_category([category_id], function(data) {
				RDB.set('tid:' + tid + ':category_name', data.categories[0].name);
				RDB.set('tid:' + tid + ':category_slug', data.categories[0].slug);
			});

			RDB.incr('cid:' + category_id + ':topiccount');
		});
	};

	Topics.lock = function(tid, uid, socket) {
		Topics.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {
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
		Topics.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {
				// Mark thread as unlocked
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
		Topics.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {
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
		Topics.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {
				// Mark thread as restored
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
		Topics.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {
				// Mark thread as pinned
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
		Topics.privileges(tid, uid, function(privileges) {
			if (privileges.editable) {
				// Mark thread as unpinned
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