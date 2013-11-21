var RDB = require('./redis.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	topics = require('./topics.js'),
	favourites = require('./favourites.js'),
	threadTools = require('./threadTools.js'),
	postTools = require('./postTools'),
	categories = require('./categories'),
	feed = require('./feed.js'),
	async = require('async'),
	plugins = require('./plugins'),
	reds = require('reds'),
	postSearch = reds.createSearch('nodebbpostsearch'),
	nconf = require('nconf'),
	meta = require('./meta.js'),
	winston = require('winston');

(function(Posts) {
	var customUserInfo = {};

	Posts.create = function(uid, tid, content, callback) {
		if (uid === null) {
			callback(new Error('invalid-user'), null);
			return;
		}

		topics.isLocked(tid, function(err, locked) {
			if(err) {
				return callback(err, null);
			} else if(locked) {
				callback(new Error('topic-locked'), null);
			}

			RDB.incr('global:next_post_id', function(err, pid) {
				if(err) {
					return callback(err, null);
				}

				plugins.fireHook('filter:post.save', content, function(err, newContent) {
					if(err) {
						return callback(err, null);
					}

					content = newContent;

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
							'relativeTime': new Date(timestamp).toISOString(),
							'post_rep': '0',
							'edited-class': 'none',
							'relativeEditTime': ''
						};

					RDB.hmset('post:' + pid, postData);

					topics.addPostToTopic(tid, pid);
					topics.increasePostCount(tid);
					topics.updateTimestamp(tid, timestamp);

					RDB.incr('totalpostcount');

					topics.getTopicFields(tid, ['cid', 'pinned'], function(err, topicData) {

						RDB.handle(err);

						var cid = topicData.cid;

						feed.updateTopic(tid);

						RDB.zadd('categories:recent_posts:cid:' + cid, timestamp, pid);

						if(topicData.pinned === '0')
							RDB.zadd('categories:' + cid + ':tid', timestamp, tid);

						RDB.scard('cid:' + cid + ':active_users', function(err, amount) {
							if (amount > 16) {
								RDB.spop('cid:' + cid + ':active_users');
							}

							categories.addActiveUser(cid, uid);
						});
					});

					user.onNewPostMade(uid, tid, pid, timestamp);

					plugins.fireHook('filter:post.get', postData, function(err, newPostData) {
						if(err) {
							return callback(err, null);
						}

						postData = newPostData;

						postTools.parse(postData.content, function(err, content) {
							if(err) {
								return callback(err, null);
							}
							postData.content = content;

							plugins.fireHook('action:post.save', postData);

							postSearch.index(content, pid);

							callback(null, postData);
						});
					});
				});
			});
		});
	};

	Posts.reply = function(tid, uid, content, callback) {
		if(content) {
			content = content.trim();
		}

		if (!content || content.length < meta.config.minimumPostLength) {
			callback(new Error('content-too-short'), null);
			return;
		}

		Posts.create(uid, tid, content, function(err, postData) {
			if(err) {
				return callback(err, null);
			} else if(!postData) {
				callback(new Error('reply-error'), null);
			}

			async.parallel([
				function(next) {
					topics.markUnRead(tid, function(err) {
						if(err) {
							return next(err);
						}
						topics.markAsRead(tid, uid);
						next();
					});
				},
				function(next) {
					Posts.getCidByPid(postData.pid, function(err, cid) {
						if(err) {
							return next(err);
						}

						RDB.del('cid:' + cid + ':read_by_uid');
						next();
					});
				},
				function(next) {
					threadTools.notifyFollowers(tid, uid);
					next();
				},
				function(next) {
					Posts.addUserInfoToPost(postData, function(err) {
						if(err) {
							return next(err);
						}

						var socketData = {
							posts: [postData]
						};

						io.sockets.in('topic_' + tid).emit('event:new_post', socketData);
						io.sockets.in('recent_posts').emit('event:new_post', socketData);
						io.sockets.in('user/' + uid).emit('event:new_post', socketData);

						next();
					});
				}
			], function(err, results) {
				if(err) {
					return callback(err, null);
				}

				callback(null, 'Reply successful');
			});
		});
	}

	Posts.getPostsByTid = function(tid, start, end, callback) {
		RDB.lrange('tid:' + tid + ':posts', start, end, function(err, pids) {
			RDB.handle(err);

			if (pids.length) {
				plugins.fireHook('filter:post.getTopic', pids, function(err, posts) {
					if (!err & 0 < posts.length) {
						Posts.getPostsByPids(pids, function(err, posts) {
							plugins.fireHook('action:post.gotTopic', posts);
							callback(posts);
						});
					} else {
						callback(posts);
					}
				});
			} else {
				callback([]);
			}
		});
	};

	Posts.addUserInfoToPost = function(post, callback) {
		user.getUserFields(post.uid, ['username', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned'], function(err, userData) {
			if (err) {
				return callback();
			}

			postTools.parse(userData.signature, function(err, signature) {
				post.username = userData.username || 'anonymous';
				post.userslug = userData.userslug || '';
				post.user_rep = userData.reputation || 0;
				post.user_postcount = userData.postcount || 0;
				post.user_banned = userData.banned || '0';
				post.picture = userData.picture || require('gravatar').url('', {}, https = nconf.get('https'));
				post.signature = signature;

				for (var info in customUserInfo) {
					if (customUserInfo.hasOwnProperty(info)) {
						post[info] = userData[info] || customUserInfo[info];
					}
				}

				plugins.fireHook('filter:posts.custom_profile_info', {profile: "", uid: post.uid}, function(err, profile_info) {
					post.additional_profile_info = profile_info.profile;

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
		});
	};

	Posts.getPostSummaryByPids = function(pids, callback) {

		var posts = [];

		function getPostSummary(pid, callback) {
			async.waterfall([
				function(next) {
					Posts.getPostFields(pid, ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted'], function(err, postData) {
						if (postData.deleted === '1') return callback(null);
						else {
							postData.relativeTime = new Date(parseInt(postData.timestamp || 0, 10)).toISOString();
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
						postTools.parse(postData.content, function(err, content) {
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

	Posts.getPostData = function(pid, callback) {
		RDB.hgetall('post:' + pid, function(err, data) {
			if(err) {
				return callback(err, null);
			}

			plugins.fireHook('filter:post.get', data, function(err, newData) {
				if(err) {
					return callback(err, null);
				}
				callback(null, newData);
			});
		});
	}

	Posts.getPostFields = function(pid, fields, callback) {
		RDB.hmgetObject('post:' + pid, fields, function(err, data) {
			if(err) {
				return callback(err, null);
			}

			// TODO: I think the plugins system needs an optional 'parameters' paramter so I don't have to do this:
			data = data || {};
			data.pid = pid;
			data.fields = fields;

			plugins.fireHook('filter:post.getFields', data, function(err, data) {
				if(err) {
					return callback(err, null);
				}
				callback(null, data);
			});
		});
	}

	Posts.getPostField = function(pid, field, callback) {
		Posts.getPostFields(pid, [field], function(err, data) {
			if(err) {
				return callback(err, null);
			}

			callback(null, data[field]);
		});
	}

	Posts.setPostField = function(pid, field, value, done) {
		RDB.hset('post:' + pid, field, value);
		plugins.fireHook('action:post.setField', {
			'pid': pid,
			'field': field,
			'value': value
		}, done);
	}

	Posts.getPostsByPids = function(pids, callback) {
		var posts = [],
			multi = RDB.multi();

		for(var x=0, numPids=pids.length; x<numPids; x++) {
			multi.hgetall("post:" + pids[x]);
		}

		multi.exec(function (err, replies) {
			async.map(replies, function(postData, _callback) {
				if (postData) {

					postData.post_rep = postData.reputation;
					postData['edited-class'] = postData.editor !== '' ? '' : 'none';
					try {
						postData.relativeTime = new Date(parseInt(postData.timestamp,10)).toISOString();
						postData.relativeEditTime = postData.edited !== '0' ? (new Date(parseInt(postData.edited,10)).toISOString()) : '';
					} catch(e) {
						winston.err('invalid time value');
					}

					if (postData.uploadedImages) {
						try {
							postData.uploadedImages = JSON.parse(postData.uploadedImages);
						} catch(err) {
							postData.uploadedImages = [];
							winston.err(err);
						}
					} else {
						postData.uploadedImages = [];
					}

                    postTools.parse(postData.content, function(err, content) {
                        postData.content = content;
						_callback(null, postData);
                    });
				} else {
					_callback(null);
				}
			}, function(err, posts) {
				if (!err) {
					return callback(null, posts);
				} else {
					return callback(err, null);
				}
			});
		})
	}

	Posts.getCidByPid = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if(err) {
				return callback(err, null);
			}

			topics.getTopicField(tid, 'cid', function(err, cid) {
				if(err) {
					return callback(err, null);
				}

				if (cid) {
					callback(null, cid);
				} else {
					callback(new Error('invalid-category-id'), null);
				}
			});
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
			message: 'You can only post every ' + meta.config.postDelay + ' seconds.',
			type: 'danger',
			timeout: 2000
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
				plugins.fireHook('filter:post.getTopic', pids, function(err, posts) {
					if (!err & 0 < posts.length) {
						Posts.getPostsByPids(pids, function(err, posts) {
							plugins.fireHook('action:post.gotTopic', posts);
							callback(posts);
						});
					} else {
						callback(posts);
					}
				});
			} else
				callback([]);
		});
	}

	Posts.getTopicPostStats = function() {
		RDB.mget(['totaltopiccount', 'totalpostcount'], function(err, data) {
			if (err === null) {
				var stats = {
					topics: data[0] ? data[0] : 0,
					posts: data[1] ? data[1] : 0
				};

				io.sockets.emit('post.stats', stats);
			} else
				console.log(err);
		});
	}

	Posts.reIndexPids = function(pids, callback) {

		function reIndex(pid, callback) {

			Posts.getPostField(pid, 'content', function(err, content) {
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
