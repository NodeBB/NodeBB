'use strict';

var async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	validator = require('validator'),
	winston = require('winston'),
	gravatar = require('gravatar'),
	S = require('string'),


	db = require('./database'),
	utils = require('./../public/src/utils'),
	user = require('./user'),
	groups = require('./groups'),
	topics = require('./topics'),
	favourites = require('./favourites'),
	postTools = require('./postTools'),
	privileges = require('./privileges'),
	categories = require('./categories'),
	plugins = require('./plugins'),
	meta = require('./meta'),
	emitter = require('./emitter');

(function(Posts) {
	require('./posts/delete')(Posts);

	Posts.create = function(data, callback) {
		var uid = data.uid,
			tid = data.tid,
			content = data.content,
			toPid = data.toPid;

		if (uid === null) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		var timestamp = Date.now(),
			postData;

		async.waterfall([
			function(next) {
				db.incrObjectField('global', 'nextPid', next);
			},
			function(pid, next) {

				postData = {
					'pid': pid,
					'uid': uid,
					'tid': tid,
					'content': content,
					'timestamp': timestamp,
					'reputation': 0,
					'votes': 0,
					'editor': '',
					'edited': 0,
					'deleted': 0
				};

				if (toPid) {
					postData.toPid = toPid;
				}

				plugins.fireHook('filter:post.save', postData, next);
			},
			function(postData, next) {
				db.setObject('post:' + postData.pid, postData, next);
			},
			function(result, next) {
				db.sortedSetAdd('posts:pid', timestamp, postData.pid);

				db.incrObjectField('global', 'postCount');

				emitter.emit('event:newpost', postData);

				plugins.fireHook('filter:post.get', postData, next);
			},
			function(postData, next) {
				postTools.parse(postData.content, function(err, content) {
					if(err) {
						return next(err);
					}

					plugins.fireHook('action:post.save', postData);

					postData.content = content;

					next(null, postData);
				});
			}
		], callback);
	};

	Posts.getPostsByTid = function(tid, set, start, end, reverse, callback) {
		db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, end, function(err, pids) {
			if(err) {
				return callback(err);
			}

			if(!Array.isArray(pids) || !pids.length) {
				return callback(null, []);
			}

			Posts.getPostsByPids(pids, function(err, posts) {
				if(err) {
					return callback(err);
				}

				if(!Array.isArray(posts) || !posts.length) {
					return callback(null, []);
				}

				plugins.fireHook('filter:post.getPosts', {tid: tid, posts: posts}, function(err, data) {
					if(err) {
						return callback(err);
					}

					if(!data || !Array.isArray(data.posts)) {
						return callback(null, []);
					}

					callback(null, data.posts);
				});
			});
		});
	};

	Posts.getPostsByPids = function(pids, callback) {
		var keys = [];

		for(var x=0, numPids=pids.length; x<numPids; ++x) {
			keys.push('post:' + pids[x]);
		}

		db.getObjects(keys, function(err, data) {
			if(err) {
				return callback(err);
			}

			async.map(data, function(postData, next) {
				if(!postData) {
					return next(null);
				}

				postData.relativeTime = utils.toISOString(postData.timestamp);
				postData.relativeEditTime = parseInt(postData.edited, 10) !== 0 ? utils.toISOString(postData.edited) : '';

				postTools.parse(postData.content, function(err, content) {
					if(err) {
						return next(err);
					}

					postData.content = content;
					next(null, postData);
				});

			}, callback);
		});
	};

	Posts.getRecentPosts = function(uid, start, stop, term, callback) {
		var terms = {
			day: 86400000,
			week: 604800000,
			month: 2592000000
		};

		var since = terms.day;
		if (terms[term]) {
			since = terms[term];
		}

		var count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;

		db.getSortedSetRevRangeByScore('posts:pid', start, count, Infinity, Date.now() - since, function(err, pids) {
			if(err) {
				return callback(err);
			}

			async.filter(pids, function(pid, next) {
				privileges.posts.can('read', pid, uid, function(err, canRead) {
					next(!err && canRead);
				});
			}, function(pids) {
				Posts.getPostSummaryByPids(pids, true, callback);
			});
		});
	};

	Posts.getUserInfoForPosts = function(uids, callback) {
		user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned'], function(err, userData) {
			if (err) {
				return callback(err);
			}

			async.map(userData, function(userData, next) {
				var userInfo = {
					uid: userData.uid,
					username: userData.username || '[[global:guest]]',
					userslug: userData.userslug || '',
					reputation: userData.reputation || 0,
					postcount: userData.postcount || 0,
					banned: parseInt(userData.banned, 10) === 1,
					picture: userData.picture || user.createGravatarURLFromEmail('')
				};

				async.parallel({
					signature: function(next) {
						if (parseInt(meta.config.disableSignatures, 10) === 1) {
							return next();
						}
						postTools.parseSignature(userData.signature, next);
					},
					customProfileInfo: function(next) {
						plugins.fireHook('filter:posts.custom_profile_info', {profile: [], uid: userData.uid}, next);
					},
					groups: function(next) {
						groups.getUserGroups(userData.uid, next);
					}
				}, function(err, results) {
					if (err) {
						return next(err);
					}
					userInfo.signature = results.signature;
					userInfo.custom_profile_info = results.custom_profile_info;
					userInfo.groups = results.groups;
					next(null, userInfo);
				});
			}, callback);
		});
	};

	Posts.getPostSummaryByPids = function(pids, stripTags, callback) {

		function getPostSummary(post, callback) {

			post.relativeTime = utils.toISOString(post.timestamp);

			async.parallel({
				user: function(next) {
					user.getUserFields(post.uid, ['username', 'userslug', 'picture'], next);
				},
				topicCategory: function(next) {
					topics.getTopicFields(post.tid, ['title', 'cid', 'slug', 'deleted'], function(err, topicData) {
						if (err) {
							return next(err);
						} else if (parseInt(topicData.deleted, 10) === 1) {
							return callback();
						}

						categories.getCategoryFields(topicData.cid, ['name', 'icon', 'slug'], function(err, categoryData) {
							if (err) {
								return next(err);
							}

							topicData.title = validator.escape(topicData.title);

							next(null, {topic: topicData, category: categoryData});
						});
					});
				},
				content: function(next) {
					if (!post.content) {
						return next(null, post.content);
					}

					postTools.parse(post.content, next);
				},
				index: function(next) {
					Posts.getPidIndex(post.pid, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				post.user = results.user;
				post.topic = results.topicCategory.topic;
				post.category = results.topicCategory.category;
				post.index = results.index;

				if (stripTags) {
					var s = S(results.content);
					post.content = s.stripTags.apply(s, utils.stripTags).s;
				} else {
					post.content = results.content;
				}


				callback(null, post);
			});
		}

		var keys = pids.map(function(pid) {
			return 'post:' + pid;
		});

		db.getObjectsFields(keys, ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted'], function(err, posts) {
			if (err) {
				return callback(err);
			}

			posts = posts.filter(function(p) {
				return !!p && parseInt(p.deleted, 10) !== 1;
			});

			async.map(posts, getPostSummary, function(err, posts) {
				if (err) {
					return callback(err);
				}

				posts = posts.filter(function(post) {
					return !!post;
				});

				return callback(null, posts);
			});
		});
	};

	Posts.getPostData = function(pid, callback) {
		db.getObject('post:' + pid, function(err, data) {
			if(err) {
				return callback(err);
			}

			plugins.fireHook('filter:post.get', data, callback);
		});
	};

	Posts.getPostFields = function(pid, fields, callback) {
		db.getObjectFields('post:' + pid, fields, function(err, data) {
			if(err) {
				return callback(err);
			}

			// TODO: I think the plugins system needs an optional 'parameters' paramter so I don't have to do this:
			data = data || {};
			data.pid = pid;
			data.fields = fields;

			plugins.fireHook('filter:post.getFields', data, callback);
		});
	};

	Posts.getPostsFields = function(pids, fields, callback) {
		var keys = pids.map(function(pid) {
			return 'post:' + pid;
		});

		db.getObjectsFields(keys, fields, callback);
	};

	Posts.getPostField = function(pid, field, callback) {
		Posts.getPostFields(pid, [field], function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, data[field]);
		});
	};

	Posts.setPostField = function(pid, field, value, callback) {
		db.setObjectField('post:' + pid, field, value, callback);
		plugins.fireHook('action:post.setField', {
			'pid': pid,
			'field': field,
			'value': value
		});
	};

	Posts.setPostFields = function(pid, data, callback) {
		db.setObject('post:' + pid, data, callback);
	};

	Posts.getCidByPid = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if(err) {
				return callback(err);
			}

			topics.getTopicField(tid, 'cid', function(err, cid) {
				if(err || !cid) {
					return callback(err || new Error('[[error:invalid-cid]]'));
				}
				callback(null, cid);
			});
		});
	};

	Posts.getCidsByPids = function(pids, callback) {
		Posts.getPostsFields(pids, ['tid'], function(err, posts) {
			if (err) {
				return callback(err);
			}

			var tids = posts.map(function(post) {
				return post.tid;
			});

			topics.getTopicsFields(tids, ['cid'], function(err, topics) {
				if (err) {
					return callback(err);
				}
				var cids = topics.map(function(topic) {
					return topic.cid;
				});
				callback(null, cids);
			});
		});
	};

	Posts.getPostsByUid = function(callerUid, uid, start, end, callback) {
		user.getPostIds(uid, start, end, function(err, pids) {
			if (err) {
				return callback(err);
			}

			async.filter(pids, function(pid, next) {
				privileges.posts.can('read', pid, callerUid, function(err, canRead) {
					next(!err && canRead);
				});
			}, function(pids) {
				getPostsFromSet('uid:' + uid + ':posts', pids, callback);
			});
		});
	};

	Posts.getFavourites = function(uid, start, end, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':favourites', start, end, function(err, pids) {
			if (err) {
				return callback(err);
			}

			getPostsFromSet('uid:' + uid + ':favourites', pids, callback);
		});
	};

	function getPostsFromSet(set, pids, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, {posts: [], nextStart: 0});
		}

		Posts.getPostSummaryByPids(pids, false, function(err, posts) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(posts) || !posts.length) {
				return callback(null, {posts: [], nextStart: 0});
			}

			db.sortedSetRevRank(set, posts[posts.length - 1].pid, function(err, rank) {
				if(err) {
					return callback(err);
				}
				var data = {
					posts: posts,
					nextStart: parseInt(rank, 10) + 1
				};
				callback(null, data);
			});
		});
	}

	Posts.getPidPage = function(pid, uid, callback) {
		if(!pid) {
			return callback(new Error('[[error:invalid-pid]]'));
		}

		var index = 0;
		async.waterfall([
			function(next) {
				Posts.getPidIndex(pid, next);
			},
			function(result, next) {
				index = result;
				if (index === 1) {
					return callback(null, 1);
				}
				user.getSettings(uid, next);
			},
			function(settings, next) {
				next(null, Math.ceil((index - 1) / settings.postsPerPage));
			}
		], callback);
	};

	Posts.getPidIndex = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if(err) {
				return callback(err);
			}

			db.sortedSetRank('tid:' + tid + ':posts', pid, function(err, index) {
				if (!utils.isNumber(index)) {
					return callback(err, 1);
				}
				callback(err, parseInt(index, 10) + 2);
			});
		});
	};

	Posts.isOwner = function(pid, uid, callback) {
		uid = parseInt(uid, 10);
		if (Array.isArray(pid)) {
			Posts.getPostsFields(pid, ['uid'], function(err, posts) {
				if (err) {
					return callback(err);
				}
				posts = posts.map(function(post) {
					return post && parseInt(post.uid, 10) === uid;
				});
				callback(null, posts);
			});
		} else {
			Posts.getPostField(pid, 'uid', function(err, author) {
				callback(err, parseInt(author, 10) === uid);
			});
		}
	};

	Posts.isMain = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if (err) {
				return callback(err);
			}
			topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
				callback(err, parseInt(pid, 10) === parseInt(mainPid, 10));
			});
		});
	};

	Posts.updatePostVoteCount = function(pid, voteCount, callback) {
		async.parallel([
			function(next) {
				Posts.getPostField(pid, 'tid', function(err, tid) {
					if (err) {
						return next(err);
					}
					topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
						if (err) {
							return next(err);
						}
						if (parseInt(mainPid, 10) === parseInt(pid, 10)) {
							return next();
						}
						db.sortedSetAdd('tid:' + tid + ':posts:votes', voteCount, pid, next);
					});
				});
			},
			function(next) {
				Posts.setPostField(pid, 'votes', voteCount, next);
			}
		], callback);
	};

}(exports));
