'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var topics = require('../topics');
var user = require('../user');
var groups = require('../groups');
var notifications = require('../notifications');
var plugins = require('../plugins');

module.exports = function (Posts) {
	Posts.delete = function (pid, uid, callback) {
		var postData;
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:post.delete', { pid: pid, uid: uid }, next);
			},
			function (data, next) {
				Posts.setPostFields(pid, { deleted: 1, deleterUid: uid }, next);
			},
			function (next) {
				Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'timestamp'], next);
			},
			function (_post, next) {
				postData = _post;
				topics.getTopicFields(_post.tid, ['tid', 'cid', 'pinned'], next);
			},
			function (topicData, next) {
				postData.cid = topicData.cid;
				async.parallel([
					function (next) {
						topics.updateLastPostTimeFromLastPid(postData.tid, next);
					},
					function (next) {
						db.sortedSetRemove('cid:' + topicData.cid + ':pids', pid, next);
					},
					function (next) {
						topics.updateTeaser(postData.tid, next);
					},
				], next);
			},
			function (results, next) {
				plugins.fireHook('action:post.delete', { post: _.clone(postData), uid: uid });
				next(null, postData);
			},
		], callback);
	};

	Posts.restore = function (pid, uid, callback) {
		var postData;
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:post.restore', { pid: pid, uid: uid }, next);
			},
			function (data, next) {
				Posts.setPostFields(pid, { deleted: 0, deleterUid: 0 }, next);
			},
			function (next) {
				Posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'timestamp'], next);
			},
			function (_post, next) {
				postData = _post;
				topics.getTopicFields(_post.tid, ['tid', 'cid', 'pinned'], next);
			},
			function (topicData, next) {
				postData.cid = topicData.cid;
				async.parallel([
					function (next) {
						topics.updateLastPostTimeFromLastPid(topicData.tid, next);
					},
					function (next) {
						db.sortedSetAdd('cid:' + topicData.cid + ':pids', postData.timestamp, pid, next);
					},
					function (next) {
						topics.updateTeaser(postData.tid, next);
					},
				], next);
			},
			function (results, next) {
				plugins.fireHook('action:post.restore', { post: _.clone(postData), uid: uid });
				next(null, postData);
			},
		], callback);
	};

	Posts.purge = function (pid, uid, callback) {
		async.waterfall([
			function (next) {
				Posts.exists(pid, next);
			},
			function (exists, next) {
				if (!exists) {
					return callback();
				}
				plugins.fireHook('filter:post.purge', { pid: pid, uid: uid }, next);
			},
			function (data, next) {
				async.parallel([
					function (next) {
						deletePostFromTopicUserNotification(pid, next);
					},
					function (next) {
						deletePostFromCategoryRecentPosts(pid, next);
					},
					function (next) {
						deletePostFromUsersBookmarks(pid, next);
					},
					function (next) {
						deletePostFromUsersVotes(pid, next);
					},
					function (next) {
						deletePostFromReplies(pid, next);
					},
					function (next) {
						deletePostFromGroups(pid, next);
					},
					function (next) {
						db.sortedSetsRemove(['posts:pid', 'posts:votes', 'posts:flagged'], pid, next);
					},
				], function (err) {
					next(err);
				});
			},
			function (next) {
				Posts.getPostData(pid, next);
			},
			function (postData, next) {
				plugins.fireHook('action:post.purge', { post: postData, uid: uid });
				db.delete('post:' + pid, next);
			},
		], callback);
	};

	function deletePostFromTopicUserNotification(pid, callback) {
		var postData;
		async.waterfall([
			function (next) {
				Posts.getPostFields(pid, ['tid', 'uid'], next);
			},
			function (_postData, next) {
				postData = _postData;
				db.sortedSetsRemove([
					'tid:' + postData.tid + ':posts',
					'tid:' + postData.tid + ':posts:votes',
					'uid:' + postData.uid + ':posts',
				], pid, next);
			},
			function (next) {
				topics.getTopicFields(postData.tid, ['tid', 'cid', 'pinned'], next);
			},
			function (topicData, next) {
				async.parallel([
					function (next) {
						db.decrObjectField('global', 'postCount', next);
					},
					function (next) {
						db.decrObjectField('category:' + topicData.cid, 'post_count', next);
					},
					function (next) {
						topics.decreasePostCount(postData.tid, next);
					},
					function (next) {
						topics.updateTeaser(postData.tid, next);
					},
					function (next) {
						topics.updateLastPostTimeFromLastPid(postData.tid, next);
					},
					function (next) {
						if (parseInt(topicData.pinned, 10) !== 1) {
							db.sortedSetIncrBy('cid:' + topicData.cid + ':tids:posts', -1, postData.tid, next);
						} else {
							next();
						}
					},
					function (next) {
						db.sortedSetIncrBy('tid:' + postData.tid + ':posters', -1, postData.uid, next);
					},
					function (next) {
						user.incrementUserPostCountBy(postData.uid, -1, next);
					},
					function (next) {
						notifications.rescind('new_post:tid:' + postData.tid + ':pid:' + pid + ':uid:' + postData.uid, next);
					},
				], next);
			},
		], function (err) {
			callback(err);
		});
	}

	function deletePostFromCategoryRecentPosts(pid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('categories:cid', 0, -1, next);
			},
			function (cids, next) {
				var sets = cids.map(function (cid) {
					return 'cid:' + cid + ':pids';
				});

				db.sortedSetsRemove(sets, pid, next);
			},
		], callback);
	}

	function deletePostFromUsersBookmarks(pid, callback) {
		async.waterfall([
			function (next) {
				db.getSetMembers('pid:' + pid + ':users_bookmarked', next);
			},
			function (uids, next) {
				var sets = uids.map(function (uid) {
					return 'uid:' + uid + ':bookmarks';
				});

				db.sortedSetsRemove(sets, pid, next);
			},
			function (next) {
				db.delete('pid:' + pid + ':users_bookmarked', next);
			},
		], callback);
	}

	function deletePostFromUsersVotes(pid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					upvoters: function (next) {
						db.getSetMembers('pid:' + pid + ':upvote', next);
					},
					downvoters: function (next) {
						db.getSetMembers('pid:' + pid + ':downvote', next);
					},
				}, next);
			},
			function (results, next) {
				var upvoterSets = results.upvoters.map(function (uid) {
					return 'uid:' + uid + ':upvote';
				});

				var downvoterSets = results.downvoters.map(function (uid) {
					return 'uid:' + uid + ':downvote';
				});

				async.parallel([
					function (next) {
						db.sortedSetsRemove(upvoterSets, pid, next);
					},
					function (next) {
						db.sortedSetsRemove(downvoterSets, pid, next);
					},
					function (next) {
						db.deleteAll(['pid:' + pid + ':upvote', 'pid:' + pid + ':downvote'], next);
					},
				], next);
			},
		], callback);
	}

	function deletePostFromReplies(pid, callback) {
		async.waterfall([
			function (next) {
				Posts.getPostField(pid, 'toPid', next);
			},
			function (toPid, next) {
				if (!parseInt(toPid, 10)) {
					return callback(null);
				}
				async.parallel([
					async.apply(db.sortedSetRemove, 'pid:' + toPid + ':replies', pid),
					async.apply(db.decrObjectField, 'post:' + toPid, 'replies'),
				], next);
			},
		], callback);
	}

	function deletePostFromGroups(pid, callback) {
		async.waterfall([
			function (next) {
				Posts.getPostField(pid, 'uid', next);
			},
			function (uid, next) {
				if (!parseInt(uid, 10)) {
					return callback();
				}
				groups.getUserGroupMembership('groups:visible:createtime', [uid], next);
			},
			function (groupNames, next) {
				groupNames = groupNames[0];
				var keys = groupNames.map(function (groupName) {
					return 'group:' + groupName + ':member:pids';
				});

				db.sortedSetsRemove(keys, pid, next);
			},
		], callback);
	}
};
