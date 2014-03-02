'use strict';

var db = require('./database'),
	utils = require('./../public/src/utils'),
	user = require('./user'),
	topics = require('./topics'),
	favourites = require('./favourites'),
	postTools = require('./postTools'),
	categories = require('./categories'),
	plugins = require('./plugins'),
	meta = require('./meta'),

	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	validator = require('validator'),
	winston = require('winston'),
	gravatar = require('gravatar'),
	S = require('string');

(function(Posts) {
	var customUserInfo = {};

	Posts.create = function(data, callback) {
		var uid = data.uid,
			tid = data.tid,
			content = data.content,
			toPid = data.toPid;

		if (uid === null) {
			return callback(new Error('invalid-user'));
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

				topics.onNewPostMade(tid, postData.pid, timestamp);
				categories.onNewPostMade(uid, tid, postData.pid, timestamp);
				user.onNewPostMade(uid, tid, postData.pid, timestamp);

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

	Posts.getPostsByTid = function(tid, start, end, reverse, callback) {
		db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange']('tid:' + tid + ':posts', start, end, function(err, pids) {
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

	Posts.getPostsByUid = function(callerUid, uid, start, end, callback) {
		user.getPostIds(uid, start, end, function(err, pids) {
			if(err) {
				return callback(err);
			}

			async.filter(pids, function(pid, next) {
				postTools.privileges(pid, callerUid, function(err, privileges) {
					next(privileges.read);
				});
			}, function(pids) {
				if (!(pids && pids.length)) {
					return callback(null, { posts: [], nextStart: 0});
				}


				Posts.getPostSummaryByPids(pids, false, function(err, posts) {
					if(err) {
						return callback(err);
					}

					if(!posts || !posts.length) {
						return callback(null, { posts: [], nextStart: 0});
					}

					db.sortedSetRevRank('uid:' + uid + ':posts', posts[posts.length - 1].pid, function(err, rank) {
						if(err) {
							return callback(err);
						}
						var userPosts = {
							posts: posts,
							nextStart: parseInt(rank, 10) + 1
						};
						callback(null, userPosts);
					});
				});
			});
		});
	};

	Posts.addUserInfoToPost = function(post, callback) {
		user.getUserFields(post.uid, ['username', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned'], function(err, userData) {
			if (err) {
				return callback(err);
			}

			postTools.parseSignature(userData.signature, function(err, signature) {
				if(err) {
					return callback(err);
				}

				post.username = userData.username || 'anonymous';
				post.userslug = userData.userslug || '';
				post.user_rep = userData.reputation || 0;
				post.user_postcount = userData.postcount || 0;
				post.user_banned = parseInt(userData.banned, 10) === 1;
				post.picture = userData.picture || gravatar.url('', {}, true);

				if(meta.config.disableSignatures === undefined || parseInt(meta.config.disableSignatures, 10) === 0) {
					post.signature = signature;
				}

				for (var info in customUserInfo) {
					if (customUserInfo.hasOwnProperty(info)) {
						post[info] = userData[info] || customUserInfo[info];
					}
				}

				plugins.fireHook('filter:posts.custom_profile_info', {profile: [], uid: post.uid, pid: post.pid}, function(err, profile_info) {
					if(err) {
						return callback(err);
					}
					post.custom_profile_info = profile_info.profile;

					if (post.editor !== '') {
						user.getUserFields(post.editor, ['username', 'userslug'], function(err, editorData) {
							if (err) {
								return callback(err);
							}

							post.editorname = editorData.username;
							post.editorslug = editorData.userslug;
							callback(null,  post);
						});
					} else {
						callback(null, post);
					}
				});
			});
		});
	};

	Posts.getPostSummaryByPids = function(pids, stripTags, callback) {

		function getPostSummary(pid, callback) {

			async.waterfall([
				function(next) {
					Posts.getPostFields(pid, ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted'], function(err, postData) {
						if(err) {
							return next(err);
						}

						if (parseInt(postData.deleted, 10) === 1) {
							return callback(null);
						} else {
							postData.relativeTime = utils.toISOString(postData.timestamp);
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
						} else if (parseInt(topicData.deleted, 10) === 1) {
							return callback(null);
						}
						categories.getCategoryFields(topicData.cid, ['name', 'icon', 'slug'], function(err, categoryData) {
							postData.categoryName = categoryData.name;
							postData.categoryIcon = categoryData.icon;
							postData.categorySlug = categoryData.slug;
							postData.title = validator.escape(topicData.title);
							postData.topicSlug = topicData.slug;
							next(null, postData);
						});
					});
				},
				function(postData, next) {
					if (!postData.content) {
						return next(null, postData);
					}

					postTools.parse(postData.content, function(err, content) {
						if(err) {
							return next(err);
						}

						if(stripTags) {
							var s = S(content);
							postData.content = s.stripTags.apply(s, utils.getTagsExcept(['img', 'i'])).s;
						} else {
							postData.content = content;
						}

						next(null, postData);
					});
				}
			], callback);
		}

		async.map(pids, getPostSummary, function(err, posts) {
			if(err) {
				return callback(err);
			}

			posts = posts.filter(function(p) {
				return p;
			});

			callback(null, posts);
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
				if(err) {
					return callback(err);
				}

				if (cid) {
					callback(null, cid);
				} else {
					callback(new Error('invalid-category-id'));
				}
			});
		});
	};

	Posts.uploadPostImage = function(image, callback) {

		if(plugins.hasListeners('filter:uploadImage')) {
			plugins.fireHook('filter:uploadImage', image, callback);
		} else {

			if (meta.config.allowFileUploads) {
				Posts.uploadPostFile(image, callback);
			} else {
				callback(new Error('Uploads are disabled!'));
			}
		}
	};

	Posts.uploadPostFile = function(file, callback) {

		if(plugins.hasListeners('filter:uploadFile')) {
			plugins.fireHook('filter:uploadFile', file, callback);
		} else {

			if(!meta.config.allowFileUploads) {
				return callback(new Error('File uploads are not allowed'));
			}

			if(!file) {
				return callback(new Error('invalid file'));
			}

			if(file.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
				return callback(new Error('File too big'));
			}

			var filename = 'upload-' + utils.generateUUID() + path.extname(file.name);
			require('./file').saveFileToLocal(filename, file.path, function(err, upload) {
				if(err) {
					return callback(err);
				}

				callback(null, {
					url: upload.url,
					name: file.name
				});
			});
		}
	};

	Posts.getFavourites = function(uid, start, end, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':favourites', start, end, function(err, pids) {
			if (err) {
				return callback(err);
			}

			Posts.getPostSummaryByPids(pids, false, function(err, posts) {
				if(err) {
					return callback(err);
				}

				if(!posts || !posts.length) {
					return callback(null, { posts: [], nextStart: 0});
				}

				db.sortedSetRevRank('uid:' + uid + ':favourites', posts[posts.length - 1].pid, function(err, rank) {
					if(err) {
						return callback(err);
					}
					var favourites = {
						posts: posts,
						nextStart: parseInt(rank, 10) + 1
					};
					callback(null, favourites);
				});
			});
		});
	};

	Posts.getPidPage = function(pid, uid, callback) {
		if(!pid) {
			return callback(new Error('invalid-pid'));
		}

		var index = 0;
		async.waterfall([
			function(next) {
				Posts.getPidIndex(pid, next);
			},
			function(result, next) {
				index = result;
				user.getSettings(uid, next);
			},
			function(settings, next) {
				next(null, Math.ceil((index + 1) / settings.postsPerPage));
			}
		], callback);
	};

	Posts.getPidIndex = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if(err) {
				return callback(err);
			}

			db.sortedSetRank('tid:' + tid + ':posts', pid, callback);
		});
	};

}(exports));
