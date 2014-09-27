'use strict';

var async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	_ = require('underscore'),
	validator = require('validator'),
	winston = require('winston'),
	gravatar = require('gravatar'),
	S = require('string'),


	db = require('./database'),
	utils = require('../public/src/utils'),
	user = require('./user'),
	groups = require('./groups'),
	topics = require('./topics'),
	favourites = require('./favourites'),
	postTools = require('./postTools'),
	privileges = require('./privileges'),
	categories = require('./categories'),
	plugins = require('./plugins'),
	meta = require('./meta'),
	emitter = require('./emitter'),
	websockets = require('./socket.io');

(function(Posts) {
	require('./posts/recent')(Posts);
	require('./posts/delete')(Posts);

	Posts.create = function(data, callback) {
		var uid = data.uid,
			tid = data.tid,
			content = data.content,
			timestamp = data.timestamp || Date.now();


		if (uid === null) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		var postData;

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

				if (data.toPid) {
					postData.toPid = data.toPid;
				}

				plugins.fireHook('filter:post.save', postData, next);
			},
			function(postData, next) {
				db.setObject('post:' + postData.pid, postData, next);
			},
			function(next) {
				async.parallel([
					function(next) {
						user.onNewPostMade(postData, next);
					},
					function(next) {
						topics.onNewPostMade(postData, next);
					},
					function(next) {
						categories.onNewPostMade(postData, next);
					},
					function(next) {
						db.sortedSetAdd('posts:pid', timestamp, postData.pid, next);
					},
					function(next) {
						db.incrObjectField('global', 'postCount', next);
					}
				], function(err) {
					if (err) {
						return next(err);
					}
					plugins.fireHook('filter:post.get', postData, next);
				});
			},
			function(postData, next) {
				postTools.parse(postData.content, function(err, content) {
					if (err) {
						return next(err);
					}

					plugins.fireHook('action:post.save', postData);

					postData.content = content;

					next(null, postData);
				});
			}
		], callback);
	};

	Posts.getPostsByTid = function(tid, set, start, end, uid, reverse, callback) {
		Posts.getPidsFromSet(set, start, end, reverse, function(err, pids) {
			if(err) {
				return callback(err);
			}

			if(!Array.isArray(pids) || !pids.length) {
				return callback(null, []);
			}

			Posts.getPostsByPids(pids, uid, callback);
		});
	};

	Posts.getPidsFromSet = function(set, start, end, reverse, callback) {
		if (isNaN(start) || isNaN(end)) {
			return callback(null, []);
		}
		db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, end, callback);
	};

	Posts.getPostsByPids = function(pids, uid, callback) {
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

			}, function(err, posts) {
				if (err) {
					return callback(err);
				}

				plugins.fireHook('filter:post.getPosts', {posts: posts, uid: uid}, function(err, data) {
					if (err) {
						return callback(err);
					}

					if (!data || !Array.isArray(data.posts)) {
						return callback(null, []);
					}
					data.posts = data.posts.filter(Boolean);
					callback(null, data.posts);
				});
			});
		});
	};

	Posts.getUserInfoForPosts = function(uids, callback) {
		async.parallel({
			groups: function(next) {
				groups.getUserGroups(uids, next);
			},
			userData: function(next) {
				user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status'], next);
			},
			online: function(next) {
				websockets.isUsersOnline(uids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var userData = results.userData;
			for(var i=0; i<userData.length; ++i) {
				userData[i].groups = results.groups[i];
				userData[i].status = !results.online[i] ? 'offline' : userData[i].status;
			}

			async.map(userData, function(userData, next) {
				userData.uid = userData.uid || 0;
				userData.username = userData.username || '[[global:guest]]';
				userData.userslug = userData.userslug || '';
				userData.reputation = userData.reputation || 0;
				userData.postcount = userData.postcount || 0;
				userData.banned = parseInt(userData.banned, 10) === 1;
				userData.picture = userData.picture || user.createGravatarURLFromEmail('');

				async.parallel({
					signature: function(next) {
						if (parseInt(meta.config.disableSignatures, 10) === 1) {
							return next();
						}
						postTools.parseSignature(userData.signature, next);
					},
					customProfileInfo: function(next) {
						plugins.fireHook('filter:posts.custom_profile_info', {profile: [], uid: userData.uid}, next);
					}
				}, function(err, results) {
					if (err) {
						return next(err);
					}
					userData.signature = results.signature;
					userData.custom_profile_info = results.customProfileInfo.profile;

					plugins.fireHook('filter:posts.modifyUserInfo', userData, next);
				});
			}, callback);
		});
	};

	Posts.getPostSummaryByPids = function(pids, uid, options, callback) {
		options.stripTags = options.hasOwnProperty('stripTags') ? options.stripTags : false;
		options.parse = options.hasOwnProperty('parse') ? options.parse : true;

		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
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

			var uids = [], tids = [];
			for(var i=0; i<posts.length; ++i) {
				if (uids.indexOf(posts[i].uid) === -1) {
					uids.push(posts[i].uid);
				}
				if (tids.indexOf('topic:' + posts[i].tid) === -1) {
					tids.push('topic:' + posts[i].tid);
				}
			}

			async.parallel({
				users: function(next) {
					user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
				},
				topicsAndCategories: function(next) {
					db.getObjectsFields(tids, ['uid', 'tid', 'title', 'cid', 'slug', 'deleted'], function(err, topics) {
						if (err) {
							return next(err);
						}

						var cidKeys = topics.map(function(topic) {
							return 'category:' + topic.cid;
						}).filter(function(value, index, array) {
							return array.indexOf(value) === index;
						});

						db.getObjectsFields(cidKeys, ['cid', 'name', 'icon', 'slug'], function(err, categories) {
							next(err, {topics: topics, categories: categories});
						});
					});
				},
				indices: function(next) {
					Posts.getPostIndices(posts, uid, next);
				}
			}, function(err, results) {
				function toObject(key, data) {
					var obj = {};
					for(var i=0; i<data.length; ++i) {
						obj[data[i][key]] = data[i];
					}
					return obj;
				}

				function stripTags(content) {
					if (options.stripTags && content) {
						var s = S(content);
						return s.stripTags.apply(s, utils.stripTags).s;
					}
					return content;
				}

				if (err) {
					return callback(err);
				}

				results.users = toObject('uid', results.users);
				results.topics = toObject('tid', results.topicsAndCategories.topics);
				results.categories = toObject('cid', results.topicsAndCategories.categories);

				for (var i=0; i<posts.length; ++i) {
					posts[i].index = utils.isNumber(results.indices[i]) ? parseInt(results.indices[i], 10) + 1 : 1;
				}

				posts = posts.filter(function(post) {
					return results.topics[post.tid] && parseInt(results.topics[post.tid].deleted, 10) !== 1;
				});

				async.map(posts, function(post, next) {
					post.user = results.users[post.uid];
					post.topic = results.topics[post.tid];
					post.category = results.categories[post.topic.cid];

					post.topic.title = validator.escape(post.topic.title);
					post.relativeTime = utils.toISOString(post.timestamp);

					if (!post.content || !options.parse) {
						post.content = stripTags(post.content);
						return next(null, post);
					}

					postTools.parse(post.content, function(err, content) {
						if (err) {
							return next(err);
						}

						post.content = stripTags(content);

						next(null, post);
					});
				}, function(err, posts) {
					plugins.fireHook('filter:post.getPostSummaryByPids', {posts: posts, uid: uid}, function(err, postData) {
						callback(err, postData.posts);
					});
				});
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
			}).filter(function(tid, index, array) {
				return tid && array.indexOf(tid) === index;
			});

			topics.getTopicsFields(tids, ['cid'], function(err, topics) {
				if (err) {
					return callback(err);
				}

				var map = {};
				topics.forEach(function(topic, index) {
					if (topic) {
						map[tids[index]] = topic.cid;
					}
				});

				var cids = posts.map(function(post) {
					return map[post.tid];
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

			privileges.posts.filter('read', pids, callerUid, function(err, pids) {
				if (err) {
					return callback(err);
				}
				getPostsFromSet('uid:' + uid + ':posts', pids, callerUid, callback);
			});
		});
	};

	Posts.getFavourites = function(uid, start, end, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':favourites', start, end, function(err, pids) {
			if (err) {
				return callback(err);
			}

			getPostsFromSet('uid:' + uid + ':favourites', pids, uid, callback);
		});
	};

	function getPostsFromSet(set, pids, uid, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, {posts: [], nextStart: 0});
		}

		Posts.getPostSummaryByPids(pids, uid, {stripTags: false}, function(err, posts) {
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

	Posts.getPidIndex = function(pid, uid, callback) {
		async.parallel({
			settings: function(next) {
				user.getSettings(uid, next);
			},
			tid: function(next) {
				Posts.getPostField(pid, 'tid', next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}
			var set = results.settings.topicPostSort === 'most_votes' ? 'tid:' + results.tid + ':posts:votes' : 'tid:' + results.tid + ':posts';
			db.sortedSetRank(set, pid, function(err, index) {
				if (!utils.isNumber(index)) {
					return callback(err, 1);
				}
				callback(err, parseInt(index, 10) + 2);
			});
		});
	};

	Posts.getPostIndices = function(posts, uid, callback) {
		if (!Array.isArray(posts) || !posts.length) {
			return callback(null, []);
		}

		user.getSettings(uid, function(err, settings) {
			if (err) {
				return callback(err);
			}

			var byVotes = settings.topicPostSort === 'most_votes';
			var sets = posts.map(function(post) {
				return byVotes ? 'tid:' + post.tid + ':posts:votes' : 'tid:' + post.tid + ':posts';
			});

			var uniqueSets = _.uniq(sets);
			var method = 'sortedSetsRanks';
			if (uniqueSets.length === 1) {
				method = 'sortedSetRanks';
				sets = uniqueSets[0];
			}

			var pids = posts.map(function(post) {
				return post.pid;
			});

			db[method](sets, pids, function(err, indices) {
				if (err) {
					return callback(err);
				}

				for (var i=0; i<indices.length; ++i) {
					indices[i] = utils.isNumber(indices[i]) ? parseInt(indices[i], 10) + 1 : 0;
				}

				callback(null, indices);
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
