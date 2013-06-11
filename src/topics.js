var	RDB = require('./redis.js')
	schema = require('./schema.js'),
	posts = require('./posts.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	categories = require('./categories.js'),
	posts = require('./posts.js'),
	marked = require('marked'),
	threadTools = require('./threadTools.js'),
	async = require('async'),
	feed = require('./feed.js');

marked.setOptions({
	breaks: true
});

(function(Topics) {
	Topics.getTopicById = function(tid, current_user, callback) {
		function getTopicData(next) {
			RDB.multi()
				.get(schema.topics(tid).title)
				.get(schema.topics(tid).locked)
				.get(schema.topics(tid).category_name)
				.get(schema.topics(tid).category_slug)
				.get(schema.topics(tid).deleted)
				.get(schema.topics(tid).pinned)
				.get(schema.topics(tid).slug)
				.exec(function(err, replies) {
						next(null, {
							topic_name: replies[0],
							locked: replies[1] || 0,
							category_name: replies[2],
							category_slug: replies[3],
							deleted: replies[4] || 0,
							pinned: replies[5] || 0,
							slug: replies[6]
						});
					});
		}

		function getTopicPosts(next) {
			posts.getPostsByTid(tid, current_user, 0, 10, function(postData) {
				next(null, postData);
			});
		}

		function getPrivileges(next) {
			threadTools.privileges(tid, current_user, function(privData) {
				next(null, privData);
			});
		}

		async.parallel([getTopicData, getTopicPosts, getPrivileges], function(err, results) {
			var	retrieved_posts = [],
			main_posts = [];

			var topicData = results[0],
				postData = results[1].postData,
				userData = results[1].userData,
				voteData = results[1].voteData,
				privileges = results[2];

			if (!postData) {
				callback(false);
				return;
			}

			for (var i=0, ii= postData.pid.length; i<ii; i++) {
				var uid = postData.uid[i],
					pid = postData.pid[i];
				

				// ############ to be moved into posts.getPostsByTid ############
				if (postData.deleted[i] === null || (postData.deleted[i] === '1' && privileges.view_deleted) || current_user === uid) {
					var post_obj = {
						'pid' : pid,
						'uid' : uid,
						'content' : marked(postData.content[i] || ''),
						'post_rep' : postData.reputation[i] || 0,
						'timestamp' : postData.timestamp[i],
						'relativeTime': utils.relativeTime(postData.timestamp[i]),
						'username' : userData[uid].username || 'anonymous',
						'user_rep' : userData[uid].reputation || 0,
						'gravatar' : userData[uid].picture || 'http://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e',
						'signature' : marked(userData[uid].signature || ''),
						'fav_star_class' : voteData[pid] ? 'icon-star' : 'icon-star-empty',
						'display_moderator_tools': (uid == current_user || privileges.editable) ? 'show' : 'none',
						'edited-class': postData.editor[i] !== null ? '' : 'none',
						'editor': postData.editor[i] !== null ? userData[postData.editor[i]].username : '',
						'relativeEditTime': postData.editTime !== null ? utils.relativeTime(postData.editTime[i]) : '',
						'deleted': postData.deleted[i] || '0'
					};

					if (i == 0) {
						main_posts.push(post_obj);
					} else {
						retrieved_posts.push(post_obj);
					}
				}
				// ########## end to be moved into posts.getPostsByTid ############
			}

			callback({
				'topic_name':topicData.topic_name,
				'category_name':topicData.category_name,
				'category_slug':topicData.category_slug,
				'locked': parseInt(topicData.locked) || 0,
				'deleted': parseInt(topicData.deleted) || 0,
				'pinned': parseInt(topicData.pinned) || 0,
				'slug': topicData.slug,
				'topic_id': tid,
				'expose_tools': privileges.editable ? 1 : 0,
				'posts': retrieved_posts,
				'main_posts': main_posts
			});

		});
	}

	Topics.get_topic = function(tid, uid, callback) {
		var topicData = {};

		function get_topic_data(next) {
			RDB.mget([
				schema.topics(tid).title,
				schema.topics(tid).uid,
				schema.topics(tid).timestamp,
				schema.topics(tid).slug,
				schema.topics(tid).postcount,
				schema.topics(tid).locked,
				schema.topics(tid).pinned,
				schema.topics(tid).deleted
			], function(err, topic) {
				if (err) {
					throw new Error(err);
				}
				
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
					
					next();
				});
			});
		}

		function get_read_status(next) {
			// posts.create calls this function - should be an option to skip this because its always true
			if (uid && parseInt(uid) > 0) {
				RDB.sismember(schema.topics(tid).read_by_uid, uid, function(err, read) {
					topicData.badgeclass = read ? '' : 'badge-important';

					next();
				});
			} else {
				next();
			}
		}

		function get_teaser(next) {
			Topics.get_teaser(tid, function(teaser) {
				topicData.teaser_text = teaser.text;
				topicData.teaser_username = teaser.username;

				next();
			});
		}

		async.parallel([get_topic_data, get_read_status, get_teaser], function(err) {
			if (err) {
				throw new Error(err);
			}

			callback(topicData);
		});
	}

	Topics.get_posts_noscript = function(tid, current_user, callback) {
		// Topics.get_topic(tid, current_user, function() {
			callback([
				{
					foo: 'bar'
				}
			]);
			// });
	}

	Topics.get_cid_by_tid = function(tid, callback) {
		RDB.get(schema.topics(tid).cid, function(err, cid) {
			if (cid && parseInt(cid) > 0) {
				callback(cid);
			} else {
				callback(false);
			}
		});
	}

	Topics.getTitle = function(tid, callback) {
		RDB.get('tid:' + tid + ':title', function(err, title) {
			console.log(tid, title);
			callback(title);
		});
	}

	Topics.getTitleByPid = function(pid, callback) {
		RDB.get('pid:' + pid + ':tid', function(err, tid) {
			if (!err) {
				Topics.getTitle(tid, function(title) {
					callback(title);
				});
			} else callback('Could not grab title');
		});
	}

	Topics.markAsRead = function(tid, uid) {
		// there is an issue with this fn. if you read a topic that is previously read you will mark the category as read anyways - there is no check
		RDB.sadd(schema.topics(tid).read_by_uid, uid);
		Topics.get_cid_by_tid(tid, function(cid) {
			RDB.sadd('cid:' + cid + ':read_by_uid', uid);
		});
	}

	Topics.hasReadTopics = function(tids, uid, callback) {
		var batch = RDB.multi();

		for (var i=0, ii=tids.length; i<ii; i++) {
			batch.sismember(schema.topics(tids[i]).read_by_uid, uid);	
		}
		
		batch.exec(function(err, hasRead) {
			callback(hasRead);
		});
	}

	Topics.get_teasers = function(tids, callback) {
		var	requests = [];
		if (Array.isArray(tids)) {
			for(x=0,numTids=tids.length;x<numTids;x++) {
				(function(tid) {
					requests.push(function(next) {
						Topics.get_teaser(tid, function(teaser_info) {
							next(null, teaser_info);
						});
					});
				})(tids[x]);
			}
			async.parallel(requests, function(err, teasers) {
				callback(teasers);
			});
		} else {
			callback([]);
		}
	}

// start: probably should be moved into posts
	Topics.get_latest_undeleted_pid = function(tid, callback) {
		RDB.lrange(schema.topics(tid).posts, 0, -1, function(err, pids) {
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
					'pid:' + pid + ':uid',
					'pid:' + pid + ':timestamp'
				], function(err, content) {
					user.getUserField(content[1], 'username', function(username) {
						var stripped = content[0],
							timestamp = content[2];
						if(content[0])
							stripped = utils.strip_tags(marked(content[0]));
						callback({
							"text": stripped,
							"username": username,
							"timestamp" : timestamp
						});
					});
				});
			}
		});
	}
// end: probably should be moved into posts

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
		
		user.getUserField(uid, 'lastposttime', function(lastposttime) {

			if(new Date().getTime() - lastposttime < config.post_delay) {
				socket.emit('event:alert', {
					title: 'Too many posts!',
					message: 'You can only post every '+ (config.post_delay / 1000) + ' seconds.',
					type: 'error',
					timeout: 2000
				});
				return;
			}

			RDB.incr(schema.global().next_topic_id, function(err, tid) {
				RDB.handle(err);

				// Global Topics
				if (uid == null) uid = 0;
				if (uid !== null) {
					RDB.sadd(schema.topics().tid, tid);	
				} else {
					// need to add some unique key sent by client so we can update this with the real uid later
					RDB.lpush(schema.topics().queued_tids, tid);
				}

				var slug = tid + '/' + utils.slugify(title);

				// Topic Info
				RDB.set(schema.topics(tid).title, title);
				RDB.set(schema.topics(tid).uid, uid);
				RDB.set(schema.topics(tid).slug, slug);
				RDB.set(schema.topics(tid).timestamp, new Date().getTime());
				
				RDB.set('topic:slug:' + slug + ':tid', tid);

				// Posts
				posts.create(uid, tid, content, function(pid) {
					if (pid > 0) {
						RDB.lpush(schema.topics(tid).posts, pid);

						// Auto-subscribe the post creator to the newly created topic
						threadTools.toggleFollow(tid, uid);

						// Notify any users looking at the category that a new topic has arrived
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

				RDB.zadd(schema.topics().recent, (new Date()).getTime(), tid);
				//RDB.zadd('topics:active', tid);

				// in future it may be possible to add topics to several categories, so leaving the door open here.
				RDB.sadd('categories:' + category_id + ':tid', tid);
				RDB.set(schema.topics(tid).cid, category_id);
				categories.getCategories([category_id], function(data) {
					RDB.set(schema.topics(tid).category_name, data.categories[0].name);
					RDB.set(schema.topics(tid).category_slug, data.categories[0].slug);
				});

				RDB.incr('cid:' + category_id + ':topiccount');

				feed.updateCategory(category_id);
			});
		});
	};

}(exports));