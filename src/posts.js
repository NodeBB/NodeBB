var RDB = require('./redis.js'),
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
	postSearch = reds.createSearch('nodebbpostsearch'),
	nconf = require('nconf'),
	meta = require('./meta.js'),
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
		user.getUserFields(post.uid, ['username', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned'], function(err, userData) {
			if (err) return callback();

			postTools.toHTML(userData.signature, function(err, signature) {
				post.username = userData.username || 'anonymous';
				post.userslug = userData.userslug || '';
				post.user_rep = userData.reputation || 0;
				post.user_postcount = userData.postcount || 0;
				post.user_banned = userData.banned || '0';
				post.picture = userData.picture || require('gravatar').url('', {}, https = nconf.get('https'));
				post.signature = signature;

				if (post.editor !== '') {
					user.getUserFields(post.editor, ['username', 'userslug'], function(err, editorData) {
						if (err) return callback();

						post.editorname = editorData.username;
						post.editorslug = editorData.userslug;
						callback();
					});
				} else {
					callback();
				}
			});
		});
	}

	Posts.getPostSummaryByPids = function(pids, callback) {

		var posts = [];

		function getPostSummary(pid, callback) {
			async.waterfall([
				function(next) {
					Posts.getPostFields(pid, ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted'], function(postData) {
						if (postData.deleted === '1') return callback(null);
						else {
							postData.relativeTime = utils.relativeTime(postData.timestamp);
							next(null, postData);
						}
					});
				},
				function(postData, next) {
					Posts.addUserInfoToPost(postData, function() {
						next(null, postData);
					});
				},
				function(postData, next) {
					topics.getTopicFields(postData.tid, ['slug', 'deleted'], function(err, topicData) {
						if (err) return callback(err);
						else if (topicData.deleted === '1') return callback(null);

						postData.topicSlug = topicData.slug;
						next(null, postData);
					});
				},
				function(postData, next) {
					if (postData.content) {
						postTools.toHTML(postData.content, function(err, content) {
							if (!err) postData.content = utils.strip_tags(content);
							next(err, postData);
						});
					} else next(null, postData);
				}
			], function(err, postData) {
				if (!err) posts.push(postData);
				callback(err);
			});
		}

		async.eachSeries(pids, getPostSummary, function(err) {
			if (!err) {
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
			if (err === null) {
				plugins.fireHook('filter:post.get', data, function(data) {
					callback(data);
				});
			} else
				console.log(err);
		});
	}

	Posts.getPostFields = function(pid, fields, callback) {
		RDB.hmgetObject('post:' + pid, fields, function(err, data) {
			if (err === null) {
				callback(data);
			} else {
				console.log(err);
			}
		});
	}

	Posts.getPostField = function(pid, field, callback) {
		RDB.hget('post:' + pid, field, function(err, data) {
			if (err === null)
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

		async.eachSeries(pids, function(pid, callback) {
			Posts.getPostData(pid, function(postData) {
				if (postData) {
					postData.relativeTime = utils.relativeTime(postData.timestamp);
					postData.post_rep = postData.reputation;
					postData['edited-class'] = postData.editor !== '' ? '' : 'none';
					postData['relativeEditTime'] = postData.edited !== '0' ? utils.relativeTime(postData.edited) : '';

					postTools.toHTML(postData.content, function(err, content) {
						postData.content = content;
						posts.push(postData);
						callback(null);
					});
				}
			});
		}, function(err) {
			if (!err) {
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
			type: 'danger',
			timeout: 2000,
			title: 'Content too short',
			message: "Please enter a longer post. At least " + meta.config.minimumPostLength + " characters.",
			alert_id: 'post_error'
		});
	}

	Posts.emitTooManyPostsAlert = function(socket) {
		socket.emit('event:alert', {
			title: 'Too many posts!',
			message: 'You can only post every ' + meta.config.postDelay / 1000 + ' seconds.',
			type: 'danger',
			timeout: 2000
		});
	}

	Posts.reply = function(tid, uid, content, callback) {
		if(content) {
			content = content.trim();
		}

		if (!content || content.length < meta.config.minimumPostLength) {
			callback(new Error('content-too-short'), null);
			return;
		}

		user.getUserField(uid, 'lastposttime', function(lastposttime) {
			if (Date.now() - lastposttime < meta.config.postDelay) {
				callback(new Error('too-many-posts'), null);
				return;
			}

			Posts.create(uid, tid, content, function(postData) {
				if (postData) {

					topics.markUnRead(tid);

					Posts.get_cid_by_pid(postData.pid, function(cid) {
						RDB.del('cid:' + cid + ':read_by_uid', function(err, data) {
							topics.markAsRead(tid, uid);
						});
					});

					threadTools.notify_followers(tid, uid);

					Posts.addUserInfoToPost(postData, function() {
						var socketData = {
							posts: [postData]
						};
						io.sockets. in ('topic_' + tid).emit('event:new_post', socketData);
						io.sockets. in ('recent_posts').emit('event:new_post', socketData);
						io.sockets. in ('users/' + uid).emit('event:new_post', socketData);
					});

					callback(null, 'Reply successful');
				} else {
					callback(new Error('reply-error'), null);
				}
			});
		});
	};

	Posts.create = function(uid, tid, content, callback) {
		if (uid === null) {
			callback(null);
			return;
		}

		topics.isLocked(tid, function(locked) {
			if (!locked || locked === '0') {
				RDB.incr('global:next_post_id', function(err, pid) {
					RDB.handle(err);

					plugins.fireHook('filter:post.save', content, function(content) {
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
								'fav_button_class': '',
								'fav_star_class': 'icon-star-empty',
								'show_banned': 'hide',
								'relativeTime': '0 seconds',
								'post_rep': '0',
								'edited-class': 'none',
								'relativeEditTime': ''
							};

						RDB.hmset('post:' + pid, postData);

						topics.addPostToTopic(tid, pid);
						topics.increasePostCount(tid);
						topics.updateTimestamp(tid, timestamp);

						RDB.incr('totalpostcount');

						topics.getTopicField(tid, 'cid', function(err, cid) {
							RDB.handle(err);

							feed.updateTopic(tid);

							RDB.zadd('categories:recent_posts:cid:' + cid, timestamp, pid);
							RDB.zadd('categories:' + cid + ':tid', timestamp, tid);

							RDB.scard('cid:' + cid + ':active_users', function(err, amount) {
								if (amount > 10) {
									RDB.spop('cid:' + cid + ':active_users');
								}

								categories.addActiveUser(cid, uid);
							});
						});

						user.onNewPostMade(uid, tid, pid, timestamp);

						async.parallel({
							content: function(next) {
								plugins.fireHook('filter:post.get', postData, function(postData) {
									postTools.toHTML(postData.content, function(err, content) {
										next(null, content);
									});
								});
							}
						}, function(err, results) {
							postData.content = results.content;
							callback(postData);
						});

						plugins.fireHook('action:post.save', [postData]);

						postSearch.index(content, pid);
					});
				});
			} else {
				callback(null);
			}
		});
	}

	Posts.uploadPostImage = function(image, callback) {
		var imgur = require('./imgur');
		imgur.setClientID(meta.config.imgurClientID);

		if(!image)
			return callback('invalid image', null);

		imgur.upload(image.data, 'base64', function(err, data) {
			if(err) {
				callback('Can\'t upload image!', null);
			} else {
				if(data.success) {
					var img= {url:data.data.link, name:image.name};

					callback(null, img);
				} else {
					winston.error('Can\'t upload image, did you set imgurClientID?');
					callback("upload error", null);
				}
			}
		});
	}

	Posts.getPostsByUid = function(uid, start, end, callback) {

		user.getPostIds(uid, start, end, function(pids) {

			if (pids && pids.length) {

				Posts.getPostsByPids(pids, function(err, posts) {
					callback(posts);
				});
			} else
				callback([]);
		});
	}

	Posts.getTopicPostStats = function(socket) {
		RDB.mget(['totaltopiccount', 'totalpostcount'], function(err, data) {
			if (err === null) {
				var stats = {
					topics: data[0] ? data[0] : 0,
					posts: data[1] ? data[1] : 0
				};

				socket.emit('post.stats', stats);
			} else
				console.log(err);
		});
	}

	Posts.reIndexPids = function(pids, callback) {

		function reIndex(pid, callback) {

			Posts.getPostField(pid, 'content', function(content) {
				postSearch.remove(pid, function() {

					if (content && content.length) {
						postSearch.index(content, pid);
					}
					callback(null);
				});
			});
		}

		async.each(pids, reIndex, function(err) {
			if (err) {
				callback(err, null);
			} else {
				callback(null, 'Posts reindexed');
			}
		});
	}

	Posts.getFavourites = function(uid, callback) {
		RDB.zrevrange('uid:' + uid + ':favourites', 0, -1, function(err, pids) {
			if (err)
				return callback(err, null);

			Posts.getPostSummaryByPids(pids, function(err, posts) {
				if (err)
					return callback(err, null);

				callback(null, posts);
			});

		});
	}

}(exports));