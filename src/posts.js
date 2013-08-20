var	RDB = require('./redis.js'),
	utils = require('./../public/src/utils.js'),
	schema = require('./schema.js'),
	user = require('./user.js'),
	topics = require('./topics.js'),
	favourites = require('./favourites.js'),
	threadTools = require('./threadTools.js'),
	postTools = require('./postTools'),
	feed = require('./feed.js'),
	async = require('async'),
	plugins = require('./plugins'),
	reds = require('reds'),
	nconf = require('nconf'),
	postSearch = reds.createSearch('nodebbpostsearch'),
	winston = require('winston');

(function(Posts) {

	Posts.getPostsByTid = function(tid, start, end, callback) {
		RDB.lrange('tid:' + tid + ':posts', start, end, function(err, pids) {

			RDB.handle(err);

			if (pids.length) {
				Posts.getPostsByPids(pids, function(err, posts) {
					callback(posts);
				});
			} else {
				callback([]);
			}
		});
	}

	Posts.addUserInfoToPost = function(post, callback) {
		user.getUserFields(post.uid, ['username', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned'], function(userData) {

			post.username = userData.username || 'anonymous';
			post.userslug = userData.userslug || '';
			post.user_rep = userData.reputation || 0;
			post.user_postcount = userData.postcount || 0;
			post.user_banned = userData.banned || '0';
			post.picture = userData.picture || require('gravatar').url('', {}, https=nconf.get('https'));
			post.signature = postTools.markdownToHTML(userData.signature, true);

			if(post.editor !== '') {
				user.getUserFields(post.editor, ['username', 'userslug'], function(editorData) {
					post.editorname = editorData.username;
					post.editorslug = editorData.userslug;
					callback();
				});
			} else {
				callback();
			}
		});
	}

	Posts.getPostSummaryByPids = function(pids, callback) {

		var posts = [];

		function getPostSummary(pid, callback) {
			Posts.getPostFields(pid, ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted'], function(postData) {
				if(postData.deleted === '1') {
					return callback(null);
				}

				Posts.addUserInfoToPost(postData, function() {
					topics.getTopicField(postData.tid, 'slug', function(err, topicSlug) {

						if(postData.content)
							postData.content = utils.strip_tags(postTools.markdownToHTML(postData.content));

						postData.relativeTime = utils.relativeTime(postData.timestamp);
						postData.topicSlug = topicSlug;
						posts.push(postData);
						callback(null);
					});
				});
			});
		}

		async.eachSeries(pids, getPostSummary, function(err) {
			if(!err) {
				callback(null, posts);
			} else {
				callback(err, null);
			}
		});
	};

	Posts.filterBannedPosts = function(posts) {
		return posts.filter(function(post) {
			return post.user_banned === '0';
		});
	}

	Posts.getPostData = function(pid, callback) {
		RDB.hgetall('post:' + pid, function(err, data) {
			if(err === null) {
				callback(data);
			}
			else
				console.log(err);
		});
	}

	Posts.getPostFields = function(pid, fields, callback) {
		RDB.hmgetObject('post:' + pid, fields, function(err, data) {
			if(err === null) {
				callback(data);
			}
			else {
				console.log(err);
			}
		});
	}

	Posts.getPostField = function(pid, field, callback) {
		RDB.hget('post:' + pid, field, function(err, data) {
			if(err === null)
				callback(data);
			else
				console.log(err);
		});
	}

	Posts.setPostField = function(pid, field, value) {
		RDB.hset('post:' + pid, field, value);
	}


	Posts.getPostsByPids = function(pids, callback) {
		var posts = [];

		function iterator(pid, callback) {
			Posts.getPostData(pid, function(postData) {
				if(postData) {
					postData.relativeTime = utils.relativeTime(postData.timestamp);
					postData.post_rep = postData.reputation;
					postData['edited-class'] = postData.editor !== '' ? '' : 'none';
					postData['relativeEditTime'] = postData.edited !== '0' ? utils.relativeTime(postData.edited) : '';

					postData.content = postTools.markdownToHTML(postData.content);

					if(postData.uploadedImages) {
						postData.uploadedImages = JSON.parse(postData.uploadedImages);
					} else {
						postData.uploadedImages = [];
					}
					posts.push(postData);
				}
				callback(null);
			});
		}

		async.eachSeries(pids, iterator, function(err) {
			if(!err) {
				callback(null, posts);
			} else {
				callback(err, null);
			}
		});
	}

	Posts.get_cid_by_pid = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(tid) {
			if (tid) {
				topics.getTopicField(tid, 'cid', function(err, cid) {
					if (cid) {
						callback(cid);
					} else {
						callback(false);
					}
				});
			}
		});
	}

	Posts.emitContentTooShortAlert = function(socket) {
		socket.emit('event:alert', {
			type: 'error',
			timeout: 2000,
			title: 'Content too short',
			message: "Please enter a longer post. At least " + config.minimumPostLength + " characters.",
			alert_id: 'post_error'
		});
	}

	Posts.emitTooManyPostsAlert = function(socket) {
		socket.emit('event:alert', {
			title: 'Too many posts!',
			message: 'You can only post every '+ config.postDelay/1000 + ' seconds.',
			type: 'error',
			timeout: 2000
		});
	}

	Posts.reply = function(tid, uid, content, images, callback) {
		if(content) {
			content = content.trim();
		}

		if (!content || content.length < config.minimumPostLength) {
			callback(new Error('content-too-short'), null);
			return;
		}

		user.getUserField(uid, 'lastposttime', function(lastposttime) {
			if(Date.now() - lastposttime < config.postDelay) {
				callback(new Error('too-many-posts'), null);
				return;
			}

			Posts.create(uid, tid, content, images, function(postData) {
				if (postData) {

					topics.markUnRead(tid);

					Posts.get_cid_by_pid(postData.pid, function(cid) {
						RDB.del('cid:' + cid + ':read_by_uid', function(err, data) {
							topics.markAsRead(tid, uid);
						});
					});

					threadTools.notify_followers(tid, uid);

					postData.content = postTools.markdownToHTML(postData.content);
					postData.post_rep = 0;
					postData.relativeTime = utils.relativeTime(postData.timestamp);
					postData.fav_button_class = '';
					postData.fav_star_class = 'icon-star-empty';
					postData['edited-class'] = 'none';
					postData.show_banned = 'hide';
					postData.uploadedImages = JSON.parse(postData.uploadedImages);

					var socketData = {
						'posts' : [
							postData
						]
					};

					posts.addUserInfoToPost(socketData['posts'][0], function() {
						io.sockets.in('topic_' + tid).emit('event:new_post', socketData);
						io.sockets.in('recent_posts').emit('event:new_post', socketData);
					});

					callback(null, 'Reply successful');
				} else {
					callback(new Error('reply-error'), null);
				}
			});
		});
	};

	Posts.create = function(uid, tid, content, images, callback) {
		if (uid === null) {
			callback(null);
			return;
		}

		topics.isLocked(tid, function(locked) {
			if (!locked || locked === '0') {
				RDB.incr('global:next_post_id', function(err, pid) {
					RDB.handle(err);

					plugins.fireHook('filter:save_post_content', content, function(content) {
						var timestamp = Date.now(),
							postData = {
								'pid': pid,
								'uid': uid,
								'tid': tid,
								'content': content,
								'timestamp': timestamp,
								'reputation': 0,
								'editor': '',
								'edited': 0,
								'deleted': 0,
								'uploadedImages': ''
							};

						RDB.hmset('post:' + pid, postData);

						topics.addPostToTopic(tid, pid);
						topics.increasePostCount(tid);
						topics.updateTimestamp(tid, timestamp);

						RDB.incr('totalpostcount');

						topics.getTopicField(tid, 'cid', function(err, cid) {
							RDB.handle(err);

							feed.updateTopic(tid, cid);

							RDB.zadd('categories:recent_posts:cid:' + cid, timestamp, pid);
							RDB.zadd('categories:' + cid + ':tid', timestamp, tid);

							// this is a bit of a naive implementation, defn something to look at post-MVP
							RDB.scard('cid:' + cid + ':active_users', function(amount) {
								if (amount > 10) {
									RDB.spop('cid:' + cid + ':active_users');
								}

								RDB.sadd('cid:' + cid + ':active_users', uid);
							});
						});

						user.onNewPostMade(uid, tid, pid, timestamp);

						uploadPostImages(postData, images, function(err, uploadedImages) {
							if(err) {
								winston.error('Uploading images failed!', err.stack);
							} else {
								postData.uploadedImages = JSON.stringify(uploadedImages);
								Posts.setPostField(pid, 'uploadedImages', postData.uploadedImages);
							}
							callback(postData);
						});

						plugins.fireHook('action:save_post_content', [pid, content]);

						postSearch.index(content, pid);
					});
				});
			} else {
				callback(null);
			}
		});
	}

	function uploadPostImages(postData, images, callback) {
		var imgur = require('./imgur');
		imgur.setClientID(config.imgurClientID);

		var uploadedImages = [];

		function uploadImage(image, callback) {
			imgur.upload(image.data, 'base64', function(err, data) {
				if(err) {
					callback(err);
				} else {
					if(data.success) {
						var img= {url:data.data.link, name:image.name};
						uploadedImages.push(img);
						callback(null);
					} else {
						winston.error('Can\'t upload image, did you set imgurClientID?');
						callback(data);
					}
				}
			});
		}

		if(!images) {
			callback(null, uploadedImages);
		} else {
			async.each(images, uploadImage, function(err) {
				if(!err) {
					callback(null, uploadedImages);
				} else {
					console.log(err);
					callback(err, null);
				}
			});
		}
	}

	Posts.getPostsByUid = function(uid, start, end, callback) {

		user.getPostIds(uid, start, end, function(pids) {

			if(pids && pids.length) {

				Posts.getPostsByPids(pids, function(err, posts) {
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

	Posts.reIndexPids = function(pids, callback) {

		function reIndex(pid, callback) {

			Posts.getPostField(pid, 'content', function(content) {
				postSearch.remove(pid, function() {

					if(content && content.length) {
						postSearch.index(content, pid);
					}
					callback(null);
				});
			});
		}

		async.each(pids, reIndex, function(err) {
			if(err) {
				callback(err, null);
			} else {
				callback(null, 'Posts reindexed');
			}
		});
	}

	Posts.getFavourites = function(uid, callback) {
		RDB.zrevrange('uid:' + uid + ':favourites', 0, -1, function(err, pids) {
			if(err)
				return callback(err, null);

			Posts.getPostSummaryByPids(pids, function(err, posts) {
				if(err)
					return callback(err, null);

				callback(null, posts);
			});

		});
	}

}(exports));