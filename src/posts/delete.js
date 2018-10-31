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
		deleteOrRestore('delete', pid, uid, callback);
	};

	Posts.restore = function (pid, uid, callback) {
		deleteOrRestore('restore', pid, uid, callback);
	};

	function deleteOrRestore(type, pid, uid, callback) {
		var postData;
		const isDeleting = type === 'delete';
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:post.' + type, { pid: pid, uid: uid }, next);
			},
			function (data, next) {
				Posts.setPostFields(pid, {
					deleted: isDeleting ? 1 : 0,
					deleterUid: isDeleting ? uid : 0,
				}, next);
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
						topics.updateLastPostTimeFromLastPid(postData.tid, next);
					},
					function (next) {
						if (isDeleting) {
							db.sortedSetRemove('cid:' + topicData.cid + ':pids', pid, next);
						} else {
							db.sortedSetAdd('cid:' + topicData.cid + ':pids', postData.timestamp, pid, next);
						}
					},
					function (next) {
						topics.updateTeaser(postData.tid, next);
					},
				], next);
			},
			function (results, next) {
				plugins.fireHook('action:post.' + type, { post: _.clone(postData), uid: uid });
				next(null, postData);
			},
		], callback);
	}

	Posts.purge = function (pid, uid, callback) {
		let postData;
		async.waterfall([
			function (next) {
				Posts.getPostData(pid, next);
			},
			function (_postData, next) {
				postData = _postData;
				if (!postData) {
					return callback();
				}
				plugins.fireHook('filter:post.purge', { post: postData, pid: pid, uid: uid }, next);
			},
			function (data, next) {
				async.parallel([
					async.apply(deletePostFromTopicUserNotification, postData),
					async.apply(deletePostFromCategoryRecentPosts, pid),
					async.apply(deletePostFromUsersBookmarks, pid),
					async.apply(deletePostFromUsersVotes, pid),
					async.apply(deletePostFromReplies, postData),
					async.apply(deletePostFromGroups, postData),
					async.apply(db.sortedSetsRemove, ['posts:pid', 'posts:votes', 'posts:flagged'], pid),
				], err => next(err));
			},
			function (next) {
				plugins.fireHook('action:post.purge', { post: postData, uid: uid });
				db.delete('post:' + pid, next);
			},
		], callback);
	};

	function deletePostFromTopicUserNotification(postData, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetsRemove([
					'tid:' + postData.tid + ':posts',
					'tid:' + postData.tid + ':posts:votes',
					'uid:' + postData.uid + ':posts',
				], postData.pid, next);
			},
			function (next) {
				topics.getTopicFields(postData.tid, ['tid', 'cid', 'pinned'], next);
			},
			function (topicData, next) {
				const tasks = [
					async.apply(db.decrObjectField, 'global', 'postCount'),
					async.apply(db.decrObjectField, 'category:' + topicData.cid, 'post_count'),
					async.apply(topics.decreasePostCount, postData.tid),
					async.apply(topics.updateTeaser, postData.tid),
					async.apply(topics.updateLastPostTimeFromLastPid, postData.tid),
					async.apply(db.sortedSetIncrBy, 'tid:' + postData.tid + ':posters', -1, postData.uid),
					async.apply(user.incrementUserPostCountBy, postData.uid, -1),
					async.apply(notifications.rescind, 'new_post:tid:' + postData.tid + ':pid:' + postData.pid + ':uid:' + postData.uid),
				];
				if (!topicData.pinned) {
					tasks.push(async.apply(db.sortedSetIncrBy, 'cid:' + topicData.cid + ':tids:posts', -1, postData.tid));
				}
				async.parallel(tasks, next);
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
				const sets = cids.map(cid => 'cid:' + cid + ':pids');
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
				const sets = uids.map(uid => 'uid:' + uid + ':bookmarks');
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
				async.parallel([
					function (next) {
						const upvoterSets = results.upvoters.map(uid => 'uid:' + uid + ':upvote');
						const downvoterSets = results.downvoters.map(uid => 'uid:' + uid + ':downvote');
						db.sortedSetsRemove(upvoterSets.concat(downvoterSets), pid, next);
					},
					function (next) {
						db.deleteAll(['pid:' + pid + ':upvote', 'pid:' + pid + ':downvote'], next);
					},
				], next);
			},
		], callback);
	}

	function deletePostFromReplies(postData, callback) {
		if (!parseInt(postData.toPid, 10)) {
			return setImmediate(callback);
		}
		async.parallel([
			async.apply(db.sortedSetRemove, 'pid:' + postData.toPid + ':replies', postData.pid),
			async.apply(db.decrObjectField, 'post:' + postData.toPid, 'replies'),
		], callback);
	}

	function deletePostFromGroups(postData, callback) {
		if (!parseInt(postData.uid, 10)) {
			return setImmediate(callback);
		}
		async.waterfall([
			function (next) {
				groups.getUserGroupMembership('groups:visible:createtime', [postData.uid], next);
			},
			function (groupNames, next) {
				groupNames = groupNames[0];
				const keys = groupNames.map(groupName => 'group:' + groupName + ':member:pids');
				db.sortedSetsRemove(keys, postData.pid, next);
			},
		], callback);
	}
};
