var	RDB = require('./redis.js')
	schema = require('./schema.js'),
	posts = require('./posts.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	categories = require('./categories.js'),
	posts = require('./posts.js'),
	marked = require('marked'),
	threadTools = require('./threadTools.js'),
	postTools = require('./postTools'),
	async = require('async'),
	feed = require('./feed.js');

marked.setOptions({
	breaks: true
});

(function(Topics) {

	Topics.getTopicData = function(tid, callback) {
		RDB.hgetall('topic:' + tid, function(err, data) {
			if(err === null)
				callback(data);
			else
				console.log(err);
		});
	}

	Topics.getTopicPosts = function(tid, callback) {
		posts.getPostsByTid(tid, 0, -1, function(postData) {
			callback(postData);
		});
	}


	function constructPosts(topicPosts, callback) {
		var done = 0;

		for(var i=0, ii=topicPosts.length; i<ii; ++i) {

			posts.addUserInfoToPost(topicPosts[i], function() {
				++done;
				if(done === topicPosts.length)
					callback();
			});
		}
	}

	Topics.getTopicById = function(tid, current_user, callback) {
		
		Topics.markAsRead(tid, current_user);

		function getTopicData(next) {
			Topics.getTopicData(tid, function(topicData) {
				next(null, topicData);
			});
		}

		function getTopicPosts(next) {
			Topics.getTopicPosts(tid, function(topicPosts) {
				next(null, topicPosts);
			});
		}

		function getPrivileges(next) {
			threadTools.privileges(tid, current_user, function(privData) {
				next(null, privData);
			});
		}

		async.parallel([getTopicData, getTopicPosts, getPrivileges], function(err, results) {
			var topicData = results[0],
				topicPosts = results[1],
				privileges = results[2];

			constructPosts(topicPosts, function() {

				var main_posts = topicPosts.splice(0, 1);

				callback({
					'topic_name':topicData.title,
					'category_name':topicData.category_name,
					'category_slug':topicData.category_slug,
					'locked': topicData.locked,
					'deleted': topicData.deleted,
					'pinned': topicData.pinned,
					'slug': topicData.slug,
					'topic_id': tid,
					'expose_tools': privileges.editable ? 1 : 0,
					'posts': topicPosts,
					'main_posts': main_posts
				});
			});

		});
	}

	Topics.get_topic = function(tid, uid, callback) {

		function get_topic_data(next) {
			Topics.getTopicData(tid, function(topic) {

				user.getUserField(topic.uid, 'username', function(username) {

					topic.username = username;
					next(null, topic);
				});
			});
		}

		function get_read_status(next) {
			// posts.create calls this function - should be an option to skip this because its always true
			if (uid && parseInt(uid) > 0) {
				RDB.sismember(schema.topics(tid).read_by_uid, uid, function(err, read) {
					next(null, read);
				});
			} else {
				next(null, null);
			}
		}

		function get_teaser(next) {
			Topics.get_teaser(tid, function(teaser) {
				next(null, teaser);
			});
		}

		async.parallel([get_topic_data, get_read_status, get_teaser], function(err, results) {
			if (err) {
				throw new Error(err);
			}
			
			var topicData = results[0];
			topicData.relativeTime = utils.relativeTime(results[0].timestamp);
			topicData.badgeclass = results[1] ? '' : 'badge-important';
			topicData.teaser_text = results[2].text;
			topicData.teaser_username = results[2].username;

			callback(topicData);
		});
	}

	Topics.getAllTopics = function(limit, after, callback) {
		RDB.smembers('topics:tid', function(err, tids) {
			var topics = [],
				numTids, x;

			// Sort into ascending order
			tids.sort(function(a, b) { return a - b; });

			// Eliminate everything after the "after" tid
			if (after) {
				for(x=0,numTids=tids.length;x<numTids;x++) {
					if (tids[x] >= after) {
						tids = tids.slice(0, x);
						break;
					}
				}
			}

			if (limit) {
				if (limit > 0 && limit < tids.length) {
					tids = tids.slice(tids.length - limit);
				}
			}

			// Sort into descending order
			tids.sort(function(a, b) { return b - a; });

			async.each(tids, function(tid, next) {
				Topics.get_topic(tid, 0, function(topicData) {
					topics.push(topicData);
					next();
				});
			}, function(err) {
				callback(topics);
			});
		});
	}

	Topics.getTitleByPid = function(pid, callback) {
		posts.getPostField(pid, 'tid', function(tid) {
			Topics.getTopicField(tid, 'title', function(title) {
				callback(title);
			});
		});
	}

	Topics.markAsRead = function(tid, uid) {
		
		RDB.sadd(schema.topics(tid).read_by_uid, uid);
		
		Topics.getTopicField(tid, 'cid', function(cid) {
					
			categories.isTopicsRead(cid, uid, function(read) {
				if(read) {
					categories.markAsRead(cid, uid);
				}
			});
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


	Topics.get_latest_undeleted_pid = function(tid, callback) {
		
		Topics.getTopicPosts(tid, function(posts) {

			var numPosts = posts.length;
			if(!numPosts)
				callback(null);
				
			while(numPosts--) {
				if(posts[numPosts].deleted !== '1') {
					callback(posts[numPosts].pid);
					break;
				}
			}
			
		});
		
	}

	Topics.get_teaser = function(tid, callback) {
		Topics.get_latest_undeleted_pid(tid, function(pid) {
			if (pid !== null) {
				
				posts.getPostFields(pid, ['content', 'uid', 'timestamp'], function(postData) {

					user.getUserField(postData.uid, 'username', function(username) {
						var stripped = postData.content,
							timestamp = postData.timestamp;
							
						if(postData.content)
							stripped = utils.strip_tags(marked(postData.content));
							
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

	Topics.post = function(socket, uid, title, content, category_id) {
		if (!category_id) 
			throw new Error('Attempted to post without a category_id');
		
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

			if(Date.now() - lastposttime < config.post_delay) {
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
				var timestamp = Date.now();

				RDB.hmset('topic:' + tid, {
					'tid': tid,
					'uid': uid,
					'cid': category_id,
					'title': title,
					'slug': slug,
					'timestamp': timestamp,
					'lastposttime': 0,
					'postcount': 0,
					'locked': 0,
					'deleted': 0,
					'pinned': 0 
				});
				
				RDB.set('topicslug:' + slug + ':tid', tid);

				posts.create(uid, tid, content, function(pid) {
					if (pid > 0) {
						RDB.lpush(schema.topics(tid).posts, pid);

						// Auto-subscribe the post creator to the newly created topic
						threadTools.toggleFollow(tid, uid);

						// Notify any users looking at the category that a new topic has arrived
						Topics.get_topic(tid, uid, function(topicData) {

							io.sockets.in('category_' + category_id).emit('event:new_topic', topicData);
							io.sockets.in('recent_posts').emit('event:new_topic', topicData);
						});

						posts.getTopicPostStats(socket);
					}
				});

				user.addTopicIdToUser(uid, tid);

				// let everyone know that there is an unread topic in this category
				RDB.del('cid:' + category_id + ':read_by_uid', function(err, data) {
					Topics.markAsRead(tid, uid);
				});


				// in future it may be possible to add topics to several categories, so leaving the door open here.
				RDB.sadd('categories:' + category_id + ':tid', tid);

				categories.getCategories([category_id], function(data) {
					Topics.setTopicField(tid, 'category_name', data.categories[0].name);
					Topics.setTopicField(tid, 'category_slug', data.categories[0].slug);
				});

				RDB.incr('cid:' + category_id + ':topiccount');
				RDB.incr('totaltopiccount');

				feed.updateCategory(category_id);

				socket.emit('event:alert', {
					title: 'Thank you for posting',
					message: 'You have successfully posted. Click here to view your post.',
					type: 'notify',
					timeout: 2000
				});
			});
		});
	};

	Topics.getTopicField = function(tid, field, callback) {
		RDB.hget('topic:' + tid, field, function(err, data) {
			if(err === null)
				callback(data);
			else
				console.log(err);
		});
	}

	Topics.setTopicField = function(tid, field, value) {
		RDB.hset('topic:' + tid, field, value);
	}

	Topics.increasePostCount = function(tid) {
		RDB.hincrby('topic:' + tid, 'postcount', 1);
	}

	Topics.isLocked = function(tid, callback) {
		Topics.getTopicField(tid, 'locked', function(locked) {
			callback(locked);
		});
	}

	Topics.addToRecent = function(tid, timestamp) {
		RDB.zadd(schema.topics().recent, timestamp, tid);
	}
	
}(exports));