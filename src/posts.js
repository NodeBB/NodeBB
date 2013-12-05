var RDB = require('./redis'),
	utils = require('./../public/src/utils'),
	user = require('./user'),
	topics = require('./topics'),
	categories = require('./categories'),
	favourites = require('./favourites'),
	threadTools = require('./threadTools'),
	postTools = require('./postTools'),
	categories = require('./categories'),
	feed = require('./feed'),
	plugins = require('./plugins'),
	meta = require('./meta'),

	async = require('async'),
	reds = require('reds'),
	postSearch = reds.createSearch('nodebbpostsearch'),
	nconf = require('nconf'),
	validator = require('validator'),
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

					var timestamp = Date.now(),
						postData = {
							'pid': pid,
							'uid': uid,
							'tid': tid,
							'content': newContent,
							'timestamp': timestamp,
							'reputation': 0,
							'editor': '',
							'edited': 0,
							'deleted': 0
						};

					RDB.hmset('post:' + pid, postData);

					postData.favourited = false;
					postData.display_moderator_tools = true;
					postData.relativeTime = new Date(timestamp).toISOString();

					topics.addPostToTopic(tid, pid);
					topics.increasePostCount(tid);
					topics.updateTimestamp(tid, timestamp);

					RDB.incr('totalpostcount');

					topics.getTopicFields(tid, ['cid', 'pinned'], function(err, topicData) {

						RDB.handle(err);

						var cid = topicData.cid;

						feed.updateTopic(tid);
						feed.updateRecent();

						RDB.zadd('categories:recent_posts:cid:' + cid, timestamp, pid);

						if(topicData.pinned === '0') {
							RDB.zadd('categories:' + cid + ':tid', timestamp, tid);
						}

						RDB.scard('cid:' + cid + ':active_users', function(err, amount) {
							if (amount > 15) {
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
		threadTools.privileges(tid, uid, function(err, privileges) {
			if (content) {
				content = content.trim();
			}

			if (!content || content.length < meta.config.minimumPostLength) {
				return callback(new Error('content-too-short'));
			} else if (!privileges.write) {
				return callback(new Error('no-privileges'));
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
						topics.pushUnreadCount(null, next);
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
							next();
						});
					}
				], function(err, results) {
					if(err) {
						return callback(err, null);
					}
					callback(null, postData);
				});
			});
		});
	}

	Posts.getPostsByTid = function(tid, start, end, callback) {
		RDB.lrange('tid:' + tid + ':posts', start, end, function(err, pids) {
			RDB.handle(err);

			if (pids.length) {
				plugins.fireHook('filter:post.getTopic', pids, function(err, posts) {
					if (!err && posts.length > 0) {
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

			postTools.parseSignature(userData.signature, function(err, signature) {
				post.username = userData.username || 'anonymous';
				post.userslug = userData.userslug || '';
				post.user_rep = userData.reputation || 0;
				post.user_postcount = userData.postcount || 0;
				post.user_banned = userData.banned === '1';
				post.picture = userData.picture || require('gravatar').url('', {}, https = nconf.get('https'));
				post.signature = signature;

				for (var info in customUserInfo) {
					if (customUserInfo.hasOwnProperty(info)) {
						post[info] = userData[info] || customUserInfo[info];
					}
				}

				plugins.fireHook('filter:posts.custom_profile_info', {profile: "", uid: post.uid, pid: post.pid}, function(err, profile_info) {
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
						if (postData.deleted === '1') {
							return callback(null);
						} else {
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
					topics.getTopicFields(postData.tid, ['title', 'cid', 'slug', 'deleted'], function(err, topicData) {
						if (err) {
							return callback(err);
						} else if (topicData.deleted === '1') {
							return callback(null);
						}
						categories.getCategoryFields(topicData.cid, ['name', 'icon', 'slug'], function(err, categoryData) {
							postData.categoryName = categoryData.name;
							postData.categoryIcon = categoryData.icon;
							postData.categorySlug = categoryData.slug;
							postData.title = validator.sanitize(topicData.title).escape();
							postData.topicSlug = topicData.slug;
							next(null, postData);
						})
					});
				},
				function(postData, next) {
					if (postData.content) {
						postTools.parse(postData.content, function(err, content) {
							if (!err) {
								postData.content = utils.strip_tags(content);
							}
							next(err, postData);
						});
					} else {
						next(null, postData);
					}
				}
			], function(err, postData) {
				if (!err) {
					posts.push(postData);
				}
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

	Posts.setPostField = function(pid, field, value, callback) {
		RDB.hset('post:' + pid, field, value, callback);
		plugins.fireHook('action:post.setField', {
			'pid': pid,
			'field': field,
			'value': value
		});
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

					try {
						postData.relativeTime = new Date(parseInt(postData.timestamp,10)).toISOString();
						postData.relativeEditTime = postData.edited !== '0' ? (new Date(parseInt(postData.edited,10)).toISOString()) : '';
					} catch(e) {
						winston.err('invalid time value');
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

		if(!image)
			return callback('invalid image', null);

		require('./imgur').upload(meta.config.imgurClientID, image.data, 'base64', function(err, data) {
			if(err) {
				callback(err.message, null);
			} else {
				callback(null, {
					url: data.link,
					name: image.name
				});
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
