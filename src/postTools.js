'use strict';

var winston = require('winston'),
	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),

	db = require('./database'),
	posts = require('./posts'),
	topics = require('./topics'),
	threadTools = require('./threadTools'),
	user = require('./user'),
	utils = require('../public/src/utils'),
	plugins = require('./plugins'),
	events = require('./events'),
	meta = require('./meta');

(function(PostTools) {

	PostTools.isMain = function(pid, tid, callback) {
		db.getSortedSetRange('tid:' + tid + ':posts', 0, 0, function(err, pids) {
			if(err) {
				return callback(err);
			}

			if(!Array.isArray(pids) || !pids.length) {
				callback(null, false);
			}

			callback(null, parseInt(pids[0], 10) === parseInt(pid, 10));
		});
	};

	PostTools.privileges = function(pid, uid, callback) {
		async.parallel({
			topicPrivs: function(next) {
				posts.getPostField(pid, 'tid', function(err, tid) {
					threadTools.privileges(tid, uid, next);
				});
			},
			isOwner: function(next) {
				posts.getPostField(pid, 'uid', function(err, author) {
					next(null, parseInt(author, 10) === parseInt(uid, 10));
				});
			},
			hasEnoughRep: function(next) {
				if (parseInt(meta.config['privileges:disabled'], 10)) {
					return next(null, false);
				} else {
					user.getUserField(uid, 'reputation', function(err, reputation) {
						if (err) {
							return next(null, false);
						}
						next(null, parseInt(reputation, 10) >= parseInt(meta.config['privileges:manage_content'], 10));
					});
				}
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}

			callback(null, {
				read: results.topicPrivs.read,
				editable: results.topicPrivs.editable || results.isOwner || results.hasEnoughRep,
				view_deleted: results.topicPrivs.view_deleted || results.isOwner || results.hasEnoughRep,
				move: results.topicPrivs.admin || results.topicPrivs.moderator
			});
		});
	};


	PostTools.edit = function(uid, pid, title, content, options, callback) {
		options = options || {};

		function success(postData) {
			posts.setPostFields(pid, {
				edited: Date.now(),
				editor: uid,
				content: postData.content
			});

			events.logPostEdit(uid, pid);

			async.parallel({
				topic: function(next) {
					var tid = postData.tid;
					PostTools.isMain(pid, tid, function(err, isMainPost) {
						if (err) {
							return next(err);
						}

						if (isMainPost) {
							title = title.trim();
							var slug = tid + '/' + utils.slugify(title);

							topics.setTopicField(tid, 'title', title);
							topics.setTopicField(tid, 'slug', slug);

							topics.setTopicField(tid, 'thumb', options.topic_thumb);

							plugins.fireHook('action:topic.edit', tid);
						}

						plugins.fireHook('action:post.edit', postData);

						next(null, {
							tid: tid,
							title: validator.escape(title),
							isMainPost: isMainPost
						});
					});

				},
				content: function(next) {
					PostTools.parse(postData.content, next);
				}
			}, callback);
		}

		PostTools.privileges(pid, uid, function(err, privileges) {
			if (err || !privileges.editable) {
				return callback(err || new Error('[[error:no-privileges]]'));
			}

			posts.getPostData(pid, function(err, postData) {
				if (err) {
					return callback(err);
				}

				postData.content = content;
				plugins.fireHook('filter:post.save', postData, function(err, postData) {
					if (err) {
						return callback(err);
					}

					success(postData);
				});
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
				PostTools.privileges(pid, uid, next);
			},
			function(privileges, next) {
				if (!privileges || !privileges.editable) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			}
		], function(err) {
			if(err) {
				return callback(err);
			}

			posts.setPostField(pid, 'deleted', isDelete ? 1 : 0, function(err) {
				if (err) {
					return callback(err);
				}

				events[isDelete ? 'logPostDelete' : 'logPostRestore'](uid, pid);

				db.incrObjectFieldBy('global', 'postCount', isDelete ? -1 : 1);

				posts.getPostFields(pid, ['tid', 'uid', 'content'], function(err, postData) {
					if (err) {
						return callback(err);
					}

					if (isDelete) {
						plugins.fireHook('action:post.delete', pid);
					} else {
						plugins.fireHook('action:post.restore', postData);
					}

					async.parallel([
						function(next) {
							topics[isDelete ? 'decreasePostCount' : 'increasePostCount'](postData.tid, next);
						},
						function(next) {
							user.incrementUserPostCountBy(postData.uid, isDelete ? -1 : 1, next);
						},
						function(next) {
							updateTopicTimestamp(postData.tid, next);
						},
						function(next) {
							addOrRemoveFromCategoryRecentPosts(pid, postData.tid, isDelete, next);
						}
					], callback);
				});
			});
		});
	}

	function updateTopicTimestamp(tid, callback) {
		threadTools.getLatestUndeletedPid(tid, function(err, pid) {
			if(err || !pid) {
				return callback(err);
			}

			posts.getPostField(pid, 'timestamp', function(err, timestamp) {
				if (err) {
					return callback(err);
				}

				if (timestamp) {
					topics.updateTimestamp(tid, timestamp);
				}
				callback();
			});
		});
	}

	function addOrRemoveFromCategoryRecentPosts(pid, tid, isDelete, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			posts.getPostField(pid, 'timestamp', function(err, timestamp) {
				if (err) {
					return callback(err);
				}

				if (isDelete) {
					db.sortedSetRemove('categories:recent_posts:cid:' + cid, pid, callback);
				} else {
					db.sortedSetAdd('categories:recent_posts:cid:' + cid, timestamp, pid, callback);
				}
			});
		});
	}

	PostTools.parse = function(raw, callback) {
		parse('filter:post.parse', raw, callback);
	};

	PostTools.parseSignature = function(raw, callback) {
		parse('filter:post.parseSignature', raw, callback);
	};

	function parse(hook, raw, callback) {
		raw = raw || '';

		plugins.fireHook(hook, raw, function(err, parsed) {
			callback(null, !err ? parsed : raw);
		});
	}

}(exports));
