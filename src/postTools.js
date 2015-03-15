'use strict';

var winston = require('winston'),
	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),

	db = require('./database'),
	posts = require('./posts'),
	topics = require('./topics'),
	threadTools = require('./threadTools'),
	privileges = require('./privileges'),
	user = require('./user'),
	utils = require('../public/src/utils'),
	plugins = require('./plugins'),
	events = require('./events'),
	meta = require('./meta'),
	LRU = require('lru-cache');

var cache = LRU({
	max: 1048576,
	length: function (n) { return n.length; },
	maxAge: 1000 * 60 * 60
});

(function(PostTools) {

	PostTools.edit = function(data, callback) {
		var options = data.options || {},
			title = data.title.trim();

		async.waterfall([
			function (next) {
				privileges.posts.canEdit(data.pid, data.uid, next);
			},
			function(canEdit, next) {
				if (!canEdit) {
					return next(new Error('[[error:no-privileges]]'));
				}
				posts.getPostData(data.pid, next);
			},
			function(postData, next) {
				postData.content = data.content;
				plugins.fireHook('filter:post.edit', {post: postData, uid: data.uid}, next);
			}
		], function(err, result) {
			if (err) {
				return callback(err);
			}

			var postData = result.post;
			async.parallel({
				post: function(next) {
					var d = {
						edited: Date.now(),
						editor: data.uid,
						content: postData.content
					};
					if (data.handle) {
						d.handle = data.handle;
					}
					posts.setPostFields(data.pid, d, next);
				},
				topic: function(next) {
					var tid = postData.tid;
					async.parallel({
						cid: function(next) {
							topics.getTopicField(tid, 'cid', next);
						},
						isMain: function(next) {
							posts.isMain(data.pid, next);
						}
					}, function(err, results) {
						if (err) {
							return next(err);
						}

						options.tags = options.tags || [];

						if (!results.isMain) {
							return next(null, {
								tid: tid,
								cid: results.cid,
								isMainPost: false
							});
						}

						var topicData = {
							tid: tid,
							cid: results.cid,
							uid: postData.uid,
							mainPid: data.pid,
							title: title,
							slug: tid + '/' + utils.slugify(title)
						};
						if (options.topic_thumb) {
							topicData.thumb = options.topic_thumb;
						}

						db.setObject('topic:' + tid, topicData, function(err) {
							plugins.fireHook('action:topic.edit', topicData);
						});

						topics.updateTags(tid, options.tags, function(err) {
							if (err) {
								return next(err);
							}
							topics.getTopicTagsObjects(tid, function(err, tags) {
								next(err, {
									tid: tid,
									cid: results.cid,
									uid: postData.uid,
									title: validator.escape(title),
									isMainPost: results.isMain,
									tags: tags
								});
							});
						});
					});
				},
				postData: function(next) {
					cache.del(postData.pid);
					PostTools.parsePost(postData, data.uid, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
				postData.cid = results.topic.cid;
				results.content = results.postData.content;

				plugins.fireHook('action:post.edit', postData);
				callback(null, results);
			});
		});
	};

	PostTools.delete = function(uid, pid, callback) {
		togglePostDelete(uid, pid, true, callback);
	};

	PostTools.restore = function(uid, pid, callback) {
		togglePostDelete(uid, pid, false, callback);
	};

	function togglePostDelete(uid, pid, isDelete, callback) {
		async.waterfall([
			function(next) {
				posts.getPostField(pid, 'deleted', next);
			},
			function(deleted, next) {
				if(parseInt(deleted, 10) === 1 && isDelete) {
					return next(new Error('[[error:post-already-deleted]]'));
				} else if(parseInt(deleted, 10) !== 1 && !isDelete) {
					return next(new Error('[[error:post-already-restored]]'));
				}

				privileges.posts.canEdit(pid, uid, next);
			},
			function(canEdit, next) {
				if (!canEdit) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			if (isDelete) {
				cache.del(pid);
				posts.delete(pid, callback);
			} else {
				posts.restore(pid, function(err, postData) {
					if (err) {
						return callback(err);
					}
					PostTools.parsePost(postData, uid, callback);
				});
			}
		});
	}

	PostTools.purge = function(uid, pid, callback) {
		privileges.posts.canEdit(pid, uid, function(err, canEdit) {
			if (err || !canEdit) {
				return callback(err || new Error('[[error:no-privileges]]'));
			}
			cache.del(pid);
			posts.purge(pid, callback);
		});
	};

	PostTools.parsePost = function(postData, uid, callback) {
		postData.content = postData.content || '';

		var cachedContent = cache.get(postData.pid);
		if (cachedContent) {
			postData.content = cachedContent;
			return callback(null, postData);
		}

		plugins.fireHook('filter:parse.post', {postData: postData, uid: uid}, function(err, data) {
			if (err) {
				return callback(err);
			}
			cache.set(data.postData.pid, data.postData.content);
			callback(null, data.postData);
		});
	};

	PostTools.parseSignature = function(userData, uid, callback) {
		userData.signature = userData.signature || '';

		plugins.fireHook('filter:parse.signature', {userData: userData, uid: uid}, callback);
	};

	PostTools.resetCache = function() {
		cache.reset();
	};

}(exports));
