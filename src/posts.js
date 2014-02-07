var db = require('./database'),
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
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	validator = require('validator'),
	winston = require('winston'),
	gravatar = require('gravatar'),
	S = require('string');

(function(Posts) {
	var customUserInfo = {};

	Posts.create = function(uid, tid, content, callback) {
		if (uid === null) {
			return callback(new Error('invalid-user'), null);
		}

		async.waterfall([
			function(next) {
				topics.isLocked(tid, next);
			},
			function(locked, next) {
				if(locked) {
					return next(new Error('topic-locked'));
				}

				db.incrObjectField('global', 'nextPid', next);
			},
			function(pid, next) {
				plugins.fireHook('filter:post.save', content, function(err, newContent) {
					next(err, pid, newContent)
				});
			},
			function(pid, newContent, next) {
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

				db.setObject('post:' + pid, postData, function(err) {
					if(err) {
						return next(err);
					}

					db.incrObjectField('global', 'postCount');

					topics.onNewPostMade(tid, pid, timestamp);
					categories.onNewPostMade(uid, tid, pid, timestamp);
					user.onNewPostMade(uid, tid, pid, timestamp);

					next(null, postData);
				});
			},
			function(postData, next) {
				plugins.fireHook('filter:post.get', postData, next);
			},
			function(postData, next) {
				postTools.parse(postData.content, function(err, content) {
					if(err) {
						return next(err, null);
					}

					postData.content = content;

					plugins.fireHook('action:post.save', postData);

					db.searchIndex('post', content, postData.pid);

					next(null, postData);
				});
			}
		], callback);
	};

	Posts.getPostsByTid = function(tid, start, end, callback) {
		db.getSortedSetRange('tid:' + tid + ':posts', start, end, function(err, pids) {
			if(err) {
				return callback(err);
			}

			if(!pids.length) {
				return callback(null, []);
			}

			plugins.fireHook('filter:post.getTopic', pids, function(err, posts) {
				if(err) {
					return callback(err);
				}

				if(!posts.length) {
					return callback(null, []);
				}


				Posts.getPostsByPids(pids, function(err, posts) {
					if(err) {
						return callback(err);
					}
					plugins.fireHook('action:post.gotTopic', posts);
					callback(null, posts);
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
							return calllback(err);
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
	}

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
							postData.title = validator.sanitize(topicData.title).escape();
							postData.topicSlug = topicData.slug;
							next(null, postData);
						})
					});
				},
				function(postData, next) {
					if (postData.content) {
						postTools.parse(postData.content, function(err, content) {
							if(err) {
								return next(err);
							}

							if(stripTags) {
								postData.content = S(content).stripTags().s;
							} else {
								postData.content = content;
							}

							next(null, postData);
						});
					} else {
						next(null, postData);
					}
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
				return callback(err, null);
			}

			plugins.fireHook('filter:post.get', data, function(err, newData) {
				if(err) {
					return callback(err, null);
				}
				callback(null, newData);
			});
		});
	};

	Posts.getPostFields = function(pid, fields, callback) {
		db.getObjectFields('post:' + pid, fields, function(err, data) {
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
	};

	Posts.getPostField = function(pid, field, callback) {
		Posts.getPostFields(pid, [field], function(err, data) {
			if(err) {
				return callback(err, null);
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

	Posts.uploadPostImage = function(image, callback) {

		if(meta.config.imgurClientID) {
			if(!image || !image.data) {
				return callback(new Error('invalid image'), null);
			}

			require('./imgur').upload(meta.config.imgurClientID, image.data, 'base64', function(err, data) {
				if(err) {
					return callback(err);
				}

				callback(null, {
					url: data.link,
					name: image.name
				});
			});
		} else if (meta.config.allowFileUploads) {
			Posts.uploadPostFile(image, callback);
		} else {
			callback(new Error('Uploads are disabled!'));
		}
	}

	Posts.uploadPostFile = function(file, callback) {

		if(!meta.config.allowFileUploads) {
			return callback(new Error('File uploads are not allowed'));
		}

		if(!file || !file.data) {
			return callback(new Error('invalid file'));
		}

		var buffer = new Buffer(file.data, 'base64');

		if(buffer.length > parseInt(meta.config.maximumFileSize, 10) * 1024) {
			return callback(new Error('File too big'));
		}

		var filename = 'upload-' + utils.generateUUID() + path.extname(file.name);
		var uploadPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), filename);

		fs.writeFile(uploadPath, buffer, function (err) {
			if(err) {
				return callback(err);
			}

			callback(null, {
				url: nconf.get('upload_url') + filename,
				name: file.name
			});
		});
	}

	Posts.reIndexPids = function(pids, callback) {

		function reIndex(pid, next) {

			Posts.getPostField(pid, 'content', function(err, content) {
				if(err) {
					return next(err);
				}

				db.searchRemove('post', pid, function() {
					if (content && content.length) {
						db.searchIndex('post', content, pid);
					}
					next();
				});
			});
		}

		async.each(pids, reIndex, callback);
	}

	// this function should really be called User.getFavouritePosts
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
						return calllback(err);
					}
					var favourites = {
						posts: posts,
						nextStart: parseInt(rank, 10) + 1
					};
					callback(null, favourites);
				});
			});
		});
	}

	Posts.getPidPage = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if(err) {
				return callback(err);
			}

			topics.getPids(tid, function(err, pids) {
				if(err) {
					return callback(err);
				}

				var index = pids.indexOf(pid);
				if(index === -1) {
					return callback(new Error('pid not found'));
				}
				var postsPerPage = parseInt(meta.config.postsPerPage, 10);
				postsPerPage = postsPerPage ? postsPerPage : 20;

				var page = Math.ceil((index + 1) / postsPerPage);
				callback(null, page);
			});
		});
	}

}(exports));
