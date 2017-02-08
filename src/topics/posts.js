
'use strict';

var async = require('async');
var _ = require('underscore');
var validator = require('validator');

var db = require('../database');
var user = require('../user');
var posts = require('../posts');
var meta = require('../meta');
var plugins = require('../plugins');
var utils = require('../../public/src/utils');

module.exports = function (Topics) {

	Topics.onNewPostMade = function (postData, callback) {
		async.series([
			function (next) {
				Topics.increasePostCount(postData.tid, next);
			},
			function (next) {
				Topics.updateTimestamp(postData.tid, postData.timestamp, next);
			},
			function (next) {
				Topics.addPostToTopic(postData.tid, postData, next);
			}
		], callback);
	};

	Topics.getTopicPosts = function (tid, set, start, stop, uid, reverse, callback) {
		callback = callback || function () {};
		async.parallel({
			posts: function (next) {
				posts.getPostsFromSet(set, start, stop, uid, reverse, next);
			},
			postCount: function (next) {
				Topics.getTopicField(tid, 'postcount', next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			Topics.calculatePostIndices(results.posts, start, stop, results.postCount, reverse);

			Topics.addPostData(results.posts, uid, callback);
		});
	};

	Topics.addPostData = function (postData, uid, callback) {
		if (!Array.isArray(postData) || !postData.length) {
			return callback(null, []);
		}
		var pids = postData.map(function (post) {
			return post && post.pid;
		});

		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		async.parallel({
			bookmarks: function (next) {
				posts.hasBookmarked(pids, uid, next);
			},
			voteData: function (next) {
				posts.getVoteStatusByPostIDs(pids, uid, next);
			},
			userData: function (next) {
				var uids = [];

				for(var i = 0; i < postData.length; ++i) {
					if (postData[i] && uids.indexOf(postData[i].uid) === -1) {
						uids.push(postData[i].uid);
					}
				}

				posts.getUserInfoForPosts(uids, uid, function (err, users) {
					if (err) {
						return next(err);
					}

					var userData = {};
					users.forEach(function (user, index) {
						userData[uids[index]] = user;
					});

					next(null, userData);
				});
			},
			editors: function (next) {
				var editors = [];
				for(var i = 0; i < postData.length; ++i) {
					if (postData[i] && postData[i].editor && editors.indexOf(postData[i].editor) === -1) {
						editors.push(postData[i].editor);
					}
				}

				user.getUsersFields(editors, ['uid', 'username', 'userslug'], function (err, editors) {
					if (err) {
						return next(err);
					}
					var editorData = {};
					editors.forEach(function (editor) {
						editorData[editor.uid] = editor;
					});
					next(null, editorData);
				});
			},
			parents: function (next) {
				Topics.addParentPosts(postData, next);
			},
			replies: function (next) {
				getPostReplies(pids, uid, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			postData.forEach(function (postObj, i) {
				if (postObj) {
					postObj.deleted = parseInt(postObj.deleted, 10) === 1;
					postObj.user = parseInt(postObj.uid, 10) ? results.userData[postObj.uid] : _.clone(results.userData[postObj.uid]);
					postObj.editor = postObj.editor ? results.editors[postObj.editor] : null;
					postObj.bookmarked = results.bookmarks[i];
					postObj.upvoted = results.voteData.upvotes[i];
					postObj.downvoted = results.voteData.downvotes[i];
					postObj.replies = results.replies[i];
					postObj.votes = postObj.votes || 0;
					postObj.selfPost = !!parseInt(uid, 10) && parseInt(uid, 10) === parseInt(postObj.uid, 10);

					// Username override for guests, if enabled
					if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(postObj.uid, 10) === 0 && postObj.handle) {
						postObj.user.username = validator.escape(String(postObj.handle));
					}
				}
			});

			plugins.fireHook('filter:topics.addPostData', {
				posts: postData,
				uid: uid
			}, function (err, data) {
				callback(err, data ? data.posts : null);
			});
		});
	};

	Topics.modifyPostsByPrivilege = function (topicData, topicPrivileges) {
		var loggedIn = !!parseInt(topicPrivileges.uid, 10);
		topicData.posts.forEach(function (post) {
			if (post) {
				post.display_edit_tools = topicPrivileges.isAdminOrMod || (post.selfPost && topicPrivileges['posts:edit']);
				post.display_delete_tools = topicPrivileges.isAdminOrMod || (post.selfPost && topicPrivileges['posts:delete']);
				post.display_moderator_tools = post.display_edit_tools || post.display_delete_tools;
				post.display_move_tools = topicPrivileges.isAdminOrMod && post.index !== 0;
				post.display_post_menu = topicPrivileges.isAdminOrMod || (post.selfPost && !topicData.locked) || ((loggedIn || topicData.postSharing.length) && !post.deleted);
				post.ip = topicPrivileges.isAdminOrMod ? post.ip : undefined;

				posts.modifyPostByPrivilege(post, topicPrivileges.isAdminOrMod);
			}
		});
	};

	Topics.addParentPosts = function (postData, callback) {
		var parentPids = postData.map(function (postObj) {
			return postObj && postObj.hasOwnProperty('toPid') ? parseInt(postObj.toPid, 10) : null;
		}).filter(Boolean);

		if (!parentPids.length) {
			return callback();
		}

		var parentPosts;
		async.waterfall([
			async.apply(posts.getPostsFields, parentPids, ['uid']),
			function (_parentPosts, next) {
				parentPosts = _parentPosts;
				var parentUids = parentPosts.map(function (postObj) { return parseInt(postObj.uid, 10); }).filter(function (uid, idx, users) {
					return users.indexOf(uid) === idx;
				});

				user.getUsersFields(parentUids, ['username'], next);
			},
			function (userData, next) {
				var usersMap = {};
				userData.forEach(function (user) {
					usersMap[user.uid] = user.username;
				});
				var parents = {};
				parentPosts.forEach(function (post, i) {
					parents[parentPids[i]] = {username: usersMap[post.uid]};
				});

				postData.forEach(function (post) {
					post.parent = parents[post.toPid];
				});
				next();
			}
		], callback);
	};

	Topics.calculatePostIndices = function (posts, start, stop, postCount, reverse) {
		posts.forEach(function (post, index) {
			if (reverse) {
				post.index = postCount - (start + index + 1);
			} else {
				post.index = start + index + 1;
			}
		});
	};

	Topics.getLatestUndeletedPid = function (tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestUndeletedReply(tid, next);
			},
			function (pid, next) {
				if (parseInt(pid, 10)) {
					return callback(null, pid.toString());
				}
				Topics.getTopicField(tid, 'mainPid', next);
			},
			function (mainPid, next) {
				posts.getPostFields(mainPid, ['pid', 'deleted'], next);
			},
			function (mainPost, next) {
				next(null, parseInt(mainPost.pid, 10) && parseInt(mainPost.deleted, 10) !== 1 ? mainPost.pid.toString() : null);
			}
		], callback);
	};

	Topics.getLatestUndeletedReply = function (tid, callback) {
		var isDeleted = false;
		var done = false;
		var latestPid = null;
		var index = 0;
		async.doWhilst(
			function (next) {
				db.getSortedSetRevRange('tid:' + tid + ':posts', index, index, function (err, pids) {
					if (err) {
						return next(err);
					}

					if (!Array.isArray(pids) || !pids.length) {
						done = true;
						return next();
					}

					posts.getPostField(pids[0], 'deleted', function (err, deleted) {
						if (err) {
							return next(err);
						}

						isDeleted = parseInt(deleted, 10) === 1;
						if (!isDeleted) {
							latestPid = pids[0];
						}
						++index;
						next();
					});
				});
			},
			function () {
				return isDeleted && !done;
			},
			function (err) {
				callback(err, latestPid);
			}
		);
	};

	Topics.addPostToTopic = function (tid, postData, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'mainPid', next);
			},
			function (mainPid, next) {
				if (!parseInt(mainPid, 10)) {
					Topics.setTopicField(tid, 'mainPid', postData.pid, next);
				} else {
					async.parallel([
						function (next) {
							db.sortedSetAdd('tid:' + tid + ':posts', postData.timestamp, postData.pid, next);
						},
						function (next) {
							var upvotes = parseInt(postData.upvotes, 10) || 0;
							var downvotes = parseInt(postData.downvotes, 10) || 0;
							var votes = upvotes - downvotes;
							db.sortedSetAdd('tid:' + tid + ':posts:votes', votes, postData.pid, next);
						}
					], function (err) {
						next(err);
					});
				}
			},
			function (next) {
				db.sortedSetIncrBy('tid:' + tid + ':posters', 1, postData.uid, next);
			},
			function (count, next) {
				Topics.updateTeaser(tid, next);
			}
		], callback);
	};

	Topics.removePostFromTopic = function (tid, postData, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetsRemove([
					'tid:' + tid + ':posts',
					'tid:' + tid + ':posts:votes'
				], postData.pid, next);
			},
			function (next) {
				db.sortedSetIncrBy('tid:' + tid + ':posters', -1, postData.uid, next);
			},
			function (count, next) {
				Topics.updateTeaser(tid, next);
			}
		], callback);
	};

	Topics.getPids = function (tid, callback) {
		async.parallel({
			mainPid: function (next) {
				Topics.getTopicField(tid, 'mainPid', next);
			},
			pids: function (next) {
				db.getSortedSetRange('tid:' + tid + ':posts', 0, -1, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			if (results.mainPid) {
				results.pids = [results.mainPid].concat(results.pids);
			}
			callback(null, results.pids);
		});
	};

	Topics.increasePostCount = function (tid, callback) {
		incrementFieldAndUpdateSortedSet(tid, 'postcount', 1, 'topics:posts', callback);
	};

	Topics.decreasePostCount = function (tid, callback) {
		incrementFieldAndUpdateSortedSet(tid, 'postcount', -1, 'topics:posts', callback);
	};

	Topics.increaseViewCount = function (tid, callback) {
		incrementFieldAndUpdateSortedSet(tid, 'viewcount', 1, 'topics:views', callback);
	};

	function incrementFieldAndUpdateSortedSet(tid, field, by, set, callback) {
		callback = callback || function () {};
		db.incrObjectFieldBy('topic:' + tid, field, by, function (err, value) {
			if (err) {
				return callback(err);
			}
			db.sortedSetAdd(set, value, tid, callback);
		});
	}

	Topics.getTitleByPid = function (pid, callback) {
		Topics.getTopicFieldByPid('title', pid, callback);
	};

	Topics.getTopicFieldByPid = function (field, pid, callback) {
		posts.getPostField(pid, 'tid', function (err, tid) {
			if (err) {
				return callback(err);
			}
			Topics.getTopicField(tid, field, callback);
		});
	};

	Topics.getTopicDataByPid = function (pid, callback) {
		posts.getPostField(pid, 'tid', function (err, tid) {
			if (err) {
				return callback(err);
			}
			Topics.getTopicData(tid, callback);
		});
	};

	Topics.getPostCount = function (tid, callback) {
		db.getObjectField('topic:' + tid, 'postcount', callback);
	};

	function getPostReplies(pids, callerUid, callback) {
		async.map(pids, function (pid, next) {
			db.getSortedSetRange('pid:' + pid + ':replies', 0, -1, function (err, replyPids) {
				var uids = [], count = 0;

				async.until(function () {
					return count === replyPids.length || uids.length === 6;
				}, function (next) {
					posts.getPostField(replyPids[count], 'uid', function (err, uid) {
						uid = parseInt(uid, 10);
						if (uids.indexOf(uid) === -1) {
							uids.push(uid);
						} 
						count++;
						next(err);
					});
				}, function (err) {
					async.parallel({
						"users": function (next) {
							user.getUsersWithFields(uids, ['uid', 'username', 'userslug', 'picture'], callerUid, next);
						},
						"timestampISO": function (next) {
							posts.getPostField(replyPids[0], 'timestamp', function (err, timestamp) {
								next(err, utils.toISOString(timestamp));
							});
						}
					}, function (err, replies) {
						if (replies.users.length > 5) {
							replies.users.shift();
							replies.hasMore = true;
						}

						replies.count = replyPids.length;

						next(err, replies);
					});
				});
			});
		}, callback);
	}
};
