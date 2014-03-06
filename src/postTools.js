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
				return callback(err || new Error('not-privileges-to-edit'));
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
		var success = function() {
			posts.setPostField(pid, 'deleted', 1);
			db.decrObjectField('global', 'postCount');

			plugins.fireHook('action:post.delete', pid);

			events.logPostDelete(uid, pid);

			posts.getPostFields(pid, ['tid', 'uid'], function(err, postData) {
				topics.decreasePostCount(postData.tid);

				user.decrementUserFieldBy(postData.uid, 'postcount', 1, function(err, postcount) {
					db.sortedSetAdd('users:postcount', postcount, postData.uid);
				});

				topics.getTopicField(postData.tid, 'cid', function(err, cid) {
					if(!err) {
						db.sortedSetRemove('categories:recent_posts:cid:' + cid, pid);
					}
				});

				// Delete the thread if it is the last undeleted post
				threadTools.getLatestUndeletedPid(postData.tid, function(err, pid) {
					if(err) {
						return winston.error(err.message);
					}

					if (!pid) {
						threadTools.delete(postData.tid, uid, function(err) {
							if (err) {
								winston.error('Could not delete topic (tid: ' + postData.tid + ')', err.stack);
							}
						});
					} else {
						posts.getPostField(pid, 'timestamp', function(err, timestamp) {
							topics.updateTimestamp(postData.tid, timestamp);
						});
					}
				});

				callback(null);
			});
		};

		posts.getPostField(pid, 'deleted', function(err, deleted) {
			if(parseInt(deleted, 10) === 1) {
				return callback(new Error('Post already deleted!'));
			}

			PostTools.privileges(pid, uid, function(err, privileges) {
				if (privileges.editable) {
					success();
				}
			});
		});
	};

	PostTools.restore = function(uid, pid, callback) {
		var success = function() {
			posts.setPostField(pid, 'deleted', 0);
			db.incrObjectField('global', 'postCount');

			events.logPostRestore(uid, pid);

			posts.getPostFields(pid, ['tid', 'uid', 'content'], function(err, postData) {
				topics.increasePostCount(postData.tid);

				user.incrementUserFieldBy(postData.uid, 'postcount', 1);

				threadTools.getLatestUndeletedPid(postData.tid, function(err, pid) {
					posts.getPostField(pid, 'timestamp', function(err, timestamp) {
						topics.updateTimestamp(postData.tid, timestamp);

						topics.getTopicField(postData.tid, 'cid', function(err, cid) {
							if(!err) {
								db.sortedSetAdd('categories:recent_posts:cid:' + cid, timestamp, pid);
							}
						});
					});
				});


				plugins.fireHook('action:post.restore', postData);

				// Restore topic if it is the only post
				topics.getTopicField(postData.tid, 'postcount', function(err, count) {
					if (parseInt(count, 10) === 1) {
						threadTools.restore(postData.tid, uid, function(err) {
							if(err) {
								winston.err(err);
							}
						});
					}
				});

				callback();
			});
		};

		posts.getPostField(pid, 'deleted', function(err, deleted) {
			if(parseInt(deleted, 10) === 0) {
				return callback(new Error('Post already restored'));
			}

			PostTools.privileges(pid, uid, function(err, privileges) {
				if (privileges.editable) {
					success();
				}
			});
		});
	};

	PostTools.parse = function(raw, callback) {
		raw = raw || '';

		plugins.fireHook('filter:post.parse', raw, function(err, parsed) {
			callback(null, !err ? parsed : raw);
		});
	};

	PostTools.parseSignature = function(raw, callback) {
		raw = raw || '';

		plugins.fireHook('filter:post.parseSignature', raw, function(err, parsedSignature) {
			callback(null, !err ? parsedSignature : raw);
		});
	};

}(exports));
