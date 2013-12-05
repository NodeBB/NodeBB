var db = require('./database'),
	posts = require('./posts'),
	topics = require('./topics'),
	threadTools = require('./threadTools'),
	user = require('./user'),
	websockets = require('./websockets'),
	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),

	utils = require('../public/src/utils'),
	plugins = require('./plugins'),
	reds = require('reds'),
	postSearch = reds.createSearch('nodebbpostsearch'),
	topicSearch = reds.createSearch('nodebbtopicsearch'),
	winston = require('winston'),
	meta = require('./meta'),
	Feed = require('./feed');

(function(PostTools) {
	PostTools.isMain = function(pid, tid, callback) {
		db.getListRange('tid:' + tid + ':posts', 0, 0, function(err, pids) {
			if(err) {
				return callback(err);
			}

			callback(null, pids[0] === pid);
		});
	}

	PostTools.privileges = function(pid, uid, callback) {
		if(uid == 0) {
			callback({
				editable: false,
				view_deleted: false
			});
			return;
		}

		function getThreadPrivileges(next) {
			posts.getPostField(pid, 'tid', function(err, tid) {
				threadTools.privileges(tid, uid, next);
			});
		}

		function isOwnPost(next) {
			posts.getPostField(pid, 'uid', function(err, author) {
				next(null, parseInt(author, 10) === parseInt(uid, 10));
			});
		}

		function hasEnoughRep(next) {
			user.getUserField(uid, 'reputation', function(err, reputation) {
				if (err) return next(null, false);
				next(null, parseInt(reputation, 10) >= parseInt(meta.config['privileges:manage_content'], 10));
			});
		}

		async.parallel([getThreadPrivileges, isOwnPost, hasEnoughRep], function(err, results) {
			callback({
				editable: results[0].editable || results[1] || results[2],
				view_deleted: results[0].view_deleted || results[1] || results[2]
			});
		});
	}


	PostTools.edit = function(uid, pid, title, content) {

		var	success = function() {
			async.waterfall([
				function(next) {
					posts.setPostField(pid, 'edited', Date.now());
					next(null);
				},
				function(next) {
					posts.setPostField(pid, 'editor', uid);
					next(null);
				},
				function(next) {
					posts.setPostField(pid, 'content', content);
					next(null);
				}
			]);

			postSearch.remove(pid, function() {
				postSearch.index(content, pid);
			});

			async.parallel([
				function(next) {
					posts.getPostField(pid, 'tid', function(err, tid) {
						PostTools.isMain(pid, tid, function(err, isMainPost) {
							if (isMainPost) {
								topics.setTopicField(tid, 'title', title);
								topicSearch.remove(tid, function() {
									topicSearch.index(title, tid);
								});
							}

							next(null, {
								tid: tid,
								isMainPost: isMainPost
							});
						});
					});
				},
				function(next) {
					PostTools.parse(content, next);
				}
			], function(err, results) {
				websockets.in('topic_' + results[0].tid).emit('event:post_edited', {
					pid: pid,
					title: validator.sanitize(title).escape(),
					isMainPost: results[0].isMainPost,
					content: results[1]
				});
			});
		};

		PostTools.privileges(pid, uid, function(privileges) {
			if (privileges.editable) {
				plugins.fireHook('filter:post.save', content, function(err, parsedContent) {
					if (!err) content = parsedContent;
					success();
				});
			}
		});
	}

	PostTools.delete = function(uid, pid, callback) {
		var success = function() {
			posts.setPostField(pid, 'deleted', 1);
			db.decrObjectField('global', 'postCount');
			postSearch.remove(pid);

			posts.getPostFields(pid, ['tid', 'uid'], function(err, postData) {
				db.incrObjectFieldBy('topic:' + postData.tid, 'postcount', -1);

				user.decrementUserFieldBy(postData.uid, 'postcount', 1, function(err, postcount) {
					db.sortedSetAdd('users:postcount', postcount, postData.uid);
				});

				// Delete the thread if it is the last undeleted post
				threadTools.getLatestUndeletedPid(postData.tid, function(err, pid) {
					if (err && err.message === 'no-undeleted-pids-found') {
						threadTools.delete(postData.tid, function(err) {
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

				Feed.updateTopic(postData.tid);
				Feed.updateRecent();

				callback(null);
			});
		};

		posts.getPostField(pid, 'deleted', function(err, deleted) {
			if(parseInt(deleted, 10) === 1) {
				return callback(new Error('Post already deleted!'));
			}

			PostTools.privileges(pid, uid, function(privileges) {
				if (privileges.editable) {
					success();
				}
			});
		});

	}

	PostTools.restore = function(uid, pid, callback) {
		var success = function() {
			posts.setPostField(pid, 'deleted', 0);
			db.incrObjectField('global', 'postCount');

			posts.getPostFields(pid, ['tid', 'uid', 'content'], function(err, postData) {
				db.incrObjectFieldBy('topic:' + postData.tid, 'postcount', 1);

				user.incrementUserFieldBy(postData.uid, 'postcount', 1);

				threadTools.getLatestUndeletedPid(postData.tid, function(err, pid) {
					posts.getPostField(pid, 'timestamp', function(err, timestamp) {
						topics.updateTimestamp(postData.tid, timestamp);
					});
				});

				// Restore topic if it is the only post
				topics.getTopicField(postData.tid, 'postcount', function(err, count) {
					if (parseInt(count, 10) === 1) {
						threadTools.restore(postData.tid, uid);
					}
				});

				Feed.updateTopic(postData.tid);
				Feed.updateRecent();

				postSearch.index(postData.content, pid);

				callback();
			});
		};

		posts.getPostField(pid, 'deleted', function(err, deleted) {
			if(parseInt(deleted, 10) === 0) {
				return callback(new Error('Post already restored'));
			}

			PostTools.privileges(pid, uid, function(privileges) {
				if (privileges.editable) {
					success();
				}
			});
		});
	}

	PostTools.parse = function(raw, callback) {
		raw = raw || '';

		plugins.fireHook('filter:post.parse', raw, function(err, parsed) {
			callback(null, !err ? parsed : raw);
		});
	}

	PostTools.parseSignature = function(raw, callback) {
		raw = raw || '';

		plugins.fireHook('filter:post.parseSignature', raw, function(err, parsedSignature) {
			callback(null, !err ? parsedSignature : raw);
		});
	}
}(exports));
