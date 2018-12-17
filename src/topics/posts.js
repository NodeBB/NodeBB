
'use strict';

var async = require('async');
var _ = require('lodash');
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
				Topics.updateLastPostTime(postData.tid, postData.timestamp, next);
			},
			function (next) {
				Topics.addPostToTopic(postData.tid, postData, next);
			},
		], callback);
	};

	Topics.getTopicPosts = function (tid, set, start, stop, uid, reverse, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					posts: function (next) {
						posts.getPostsFromSet(set, start, stop, uid, reverse, next);
					},
					postCount: function (next) {
						Topics.getTopicField(tid, 'postcount', next);
					},
				}, next);
			},
			function (results, next) {
				Topics.calculatePostIndices(results.posts, start, results.postCount, reverse);

				Topics.addPostData(results.posts, uid, next);
			},
		], callback);
	};

	Topics.addPostData = function (postData, uid, callback) {
		if (!Array.isArray(postData) || !postData.length) {
			return callback(null, []);
		}
		var pids = postData.map(post => post && post.pid);

		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		function getPostUserData(field, method, callback) {
			var uidsMap = {};

			postData.forEach((post) => {
				if (post && parseInt(post[field], 10) >= 0) {
					uidsMap[post[field]] = 1;
				}
			});
			const uids = Object.keys(uidsMap);

			async.waterfall([
				function (next) {
					method(uids, next);
				},
				function (users, next) {
					next(null, _.zipObject(uids, users));
				},
			], callback);
		}

		async.waterfall([
			function (next) {
				async.parallel({
					bookmarks: function (next) {
						posts.hasBookmarked(pids, uid, next);
					},
					voteData: function (next) {
						posts.getVoteStatusByPostIDs(pids, uid, next);
					},
					userData: function (next) {
						getPostUserData('uid', function (uids, next) {
							posts.getUserInfoForPosts(uids, uid, next);
						}, next);
					},
					editors: function (next) {
						getPostUserData('editor', function (uids, next) {
							user.getUsersFields(uids, ['uid', 'username', 'userslug'], next);
						}, next);
					},
					parents: function (next) {
						Topics.addParentPosts(postData, next);
					},
					replies: function (next) {
						getPostReplies(pids, uid, next);
					},
				}, next);
			},
			function (results, next) {
				postData.forEach(function (postObj, i) {
					if (postObj) {
						postObj.user = postObj.uid ? results.userData[postObj.uid] : _.clone(results.userData[postObj.uid]);
						postObj.editor = postObj.editor ? results.editors[postObj.editor] : null;
						postObj.bookmarked = results.bookmarks[i];
						postObj.upvoted = results.voteData.upvotes[i];
						postObj.downvoted = results.voteData.downvotes[i];
						postObj.votes = postObj.votes || 0;
						postObj.replies = results.replies[i];
						postObj.selfPost = parseInt(uid, 10) > 0 && parseInt(uid, 10) === postObj.uid;

						// Username override for guests, if enabled
						if (meta.config.allowGuestHandles && postObj.uid === 0 && postObj.handle) {
							postObj.user.username = validator.escape(String(postObj.handle));
						}
					}
				});
				plugins.fireHook('filter:topics.addPostData', {
					posts: postData,
					uid: uid,
				}, next);
			},
			function (data, next) {
				next(null, data.posts);
			},
		], callback);
	};

	Topics.modifyPostsByPrivilege = function (topicData, topicPrivileges) {
		var loggedIn = parseInt(topicPrivileges.uid, 10) > 0;
		topicData.posts.forEach(function (post) {
			if (post) {
				post.display_edit_tools = topicPrivileges.isAdminOrMod || (post.selfPost && topicPrivileges['posts:edit']);
				post.display_delete_tools = topicPrivileges.isAdminOrMod || (post.selfPost && topicPrivileges['posts:delete']);
				post.display_moderator_tools = post.display_edit_tools || post.display_delete_tools;
				post.display_move_tools = topicPrivileges.isAdminOrMod && post.index !== 0;
				post.display_post_menu = topicPrivileges.isAdminOrMod || (post.selfPost && !topicData.locked) || ((loggedIn || topicData.postSharing.length) && !post.deleted);
				post.ip = topicPrivileges.isAdminOrMod ? post.ip : undefined;

				posts.modifyPostByPrivilege(post, topicPrivileges);
			}
		});
	};

	Topics.addParentPosts = function (postData, callback) {
		var parentPids = postData.map(function (postObj) {
			return postObj && postObj.hasOwnProperty('toPid') ? parseInt(postObj.toPid, 10) : null;
		}).filter(Boolean);

		if (!parentPids.length) {
			return setImmediate(callback);
		}
		parentPids = _.uniq(parentPids);
		var parentPosts;
		async.waterfall([
			async.apply(posts.getPostsFields, parentPids, ['uid']),
			function (_parentPosts, next) {
				parentPosts = _parentPosts;
				var parentUids = _.uniq(parentPosts.map(postObj => postObj && postObj.uid));

				user.getUsersFields(parentUids, ['username'], next);
			},
			function (userData, next) {
				var usersMap = {};
				userData.forEach(function (user) {
					usersMap[user.uid] = user.username;
				});
				var parents = {};
				parentPosts.forEach(function (post, i) {
					parents[parentPids[i]] = { username: usersMap[post.uid] };
				});

				postData.forEach(function (post) {
					post.parent = parents[post.toPid];
				});
				next();
			},
		], callback);
	};

	Topics.calculatePostIndices = function (posts, start, postCount, reverse) {
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
				if (pid) {
					return callback(null, pid);
				}
				Topics.getTopicField(tid, 'mainPid', next);
			},
			function (mainPid, next) {
				posts.getPostFields(mainPid, ['pid', 'deleted'], next);
			},
			function (mainPost, next) {
				next(null, mainPost.pid && !mainPost.deleted ? mainPost.pid : null);
			},
		], callback);
	};

	Topics.getLatestUndeletedReply = function (tid, callback) {
		var isDeleted = false;
		var done = false;
		var latestPid = null;
		var index = 0;
		var pids;
		async.doWhilst(
			function (next) {
				async.waterfall([
					function (_next) {
						db.getSortedSetRevRange('tid:' + tid + ':posts', index, index, _next);
					},
					function (_pids, _next) {
						pids = _pids;
						if (!pids.length) {
							done = true;
							return next();
						}

						posts.getPostField(pids[0], 'deleted', _next);
					},
					function (deleted, _next) {
						isDeleted = deleted;
						if (!isDeleted) {
							latestPid = pids[0];
						}
						index += 1;
						_next();
					},
				], next);
			},
			function () {
				return isDeleted && !done;
			},
			function (err) {
				callback(err, parseInt(latestPid, 10));
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
						},
					], function (err) {
						next(err);
					});
				}
			},
			function (next) {
				Topics.increasePostCount(tid, next);
			},
			function (next) {
				db.sortedSetIncrBy('tid:' + tid + ':posters', 1, postData.uid, next);
			},
			function (count, next) {
				Topics.updateTeaser(tid, next);
			},
		], callback);
	};

	Topics.removePostFromTopic = function (tid, postData, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetsRemove([
					'tid:' + tid + ':posts',
					'tid:' + tid + ':posts:votes',
				], postData.pid, next);
			},
			function (next) {
				Topics.decreasePostCount(tid, next);
			},
			function (next) {
				db.sortedSetIncrBy('tid:' + tid + ':posters', -1, postData.uid, next);
			},
			function (count, next) {
				Topics.updateTeaser(tid, next);
			},
		], callback);
	};

	Topics.getPids = function (tid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					mainPid: function (next) {
						Topics.getTopicField(tid, 'mainPid', next);
					},
					pids: function (next) {
						db.getSortedSetRange('tid:' + tid + ':posts', 0, -1, next);
					},
				}, next);
			},
			function (results, next) {
				if (parseInt(results.mainPid, 10)) {
					results.pids = [results.mainPid].concat(results.pids);
				}
				next(null, results.pids);
			},
		], callback);
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
		async.waterfall([
			function (next) {
				db.incrObjectFieldBy('topic:' + tid, field, by, next);
			},
			function (value, next) {
				db.sortedSetAdd(set, value, tid, next);
			},
		], callback);
	}

	Topics.getTitleByPid = function (pid, callback) {
		Topics.getTopicFieldByPid('title', pid, callback);
	};

	Topics.getTopicFieldByPid = function (field, pid, callback) {
		async.waterfall([
			function (next) {
				posts.getPostField(pid, 'tid', next);
			},
			function (tid, next) {
				Topics.getTopicField(tid, field, next);
			},
		], callback);
	};

	Topics.getTopicDataByPid = function (pid, callback) {
		async.waterfall([
			function (next) {
				posts.getPostField(pid, 'tid', next);
			},
			function (tid, next) {
				Topics.getTopicData(tid, next);
			},
		], callback);
	};

	Topics.getPostCount = function (tid, callback) {
		db.getObjectField('topic:' + tid, 'postcount', callback);
	};

	function getPostReplies(pids, callerUid, callback) {
		var arrayOfReplyPids;
		var replyData;
		var uniqueUids;
		var uniquePids;
		async.waterfall([
			function (next) {
				const keys = pids.map(pid => 'pid:' + pid + ':replies');
				db.getSortedSetsMembers(keys, next);
			},
			function (arrayOfPids, next) {
				arrayOfReplyPids = arrayOfPids;

				uniquePids = _.uniq(_.flatten(arrayOfPids));

				posts.getPostsFields(uniquePids, ['pid', 'uid', 'timestamp'], next);
			},
			function (_replyData, next) {
				replyData = _replyData;
				const uids = replyData.map(replyData => replyData && replyData.uid);

				uniqueUids = _.uniq(uids);

				user.getUsersWithFields(uniqueUids, ['uid', 'username', 'userslug', 'picture'], callerUid, next);
			},
			function (userData, next) {
				var uidMap = _.zipObject(uniqueUids, userData);
				var pidMap = _.zipObject(uniquePids, replyData);

				var returnData = arrayOfReplyPids.map(function (replyPids) {
					var uidsUsed = {};
					var currentData = {
						hasMore: false,
						users: [],
						text: replyPids.length > 1 ? '[[topic:replies_to_this_post, ' + replyPids.length + ']]' : '[[topic:one_reply_to_this_post]]',
						count: replyPids.length,
						timestampISO: replyPids.length ? utils.toISOString(pidMap[replyPids[0]].timestamp) : undefined,
					};

					replyPids.sort(function (a, b) {
						return parseInt(a, 10) - parseInt(b, 10);
					});

					replyPids.forEach(function (replyPid) {
						var replyData = pidMap[replyPid];
						if (!uidsUsed[replyData.uid] && currentData.users.length < 6) {
							currentData.users.push(uidMap[replyData.uid]);
							uidsUsed[replyData.uid] = true;
						}
					});

					if (currentData.users.length > 5) {
						currentData.users.pop();
						currentData.hasMore = true;
					}

					return currentData;
				});

				next(null, returnData);
			},
		], callback);
	}
};
