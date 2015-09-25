'use strict';

var async = require('async');

var user = require('../../user');
var groups = require('../../groups');
var posts = require('../../posts');
var topics = require('../../topics');
var privileges = require('../../privileges');
var notifications = require('../../notifications');
var plugins = require('../../plugins');
var meta = require('../../meta');

module.exports = function(SocketPosts) {

	SocketPosts.flag = function(socket, pid, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		var flaggingUser = {},
			post;

		async.waterfall([
			function (next) {
				posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'deleted'], next);
			},
			function (postData, next) {
				if (parseInt(postData.deleted, 10) === 1) {
					return next(new Error('[[error:post-deleted]]'));
				}

				post = postData;
				topics.getTopicFields(post.tid, ['title', 'cid'], next);
			},
			function (topicData, next) {
				post.topic = topicData;
				next();
			},
			function (next) {
				async.parallel({
					isAdminOrMod: function(next) {
						privileges.categories.isAdminOrMod(post.topic.cid, socket.uid, next);
					},
					userData: function(next) {
						user.getUserFields(socket.uid, ['username', 'reputation'], next);
					}
				}, next);
			},
			function (user, next) {
				if (!user.isAdminOrMod && parseInt(user.userData.reputation, 10) < parseInt(meta.config['privileges:flag'] || 1, 10)) {
					return next(new Error('[[error:not-enough-reputation-to-flag]]'));
				}

				flaggingUser = user.userData;
				flaggingUser.uid = socket.uid;

				posts.flag(post, socket.uid, next);
			},
			function (next) {
				async.parallel({
					post: function(next) {
						posts.parsePost(post, next);
					},
					admins: function(next) {
						groups.getMembers('administrators', 0, -1, next);
					},
					moderators: function(next) {
						groups.getMembers('cid:' + post.topic.cid + ':privileges:mods', 0, -1, next);
					}
				}, next);
			},
			function (results, next) {
				notifications.create({
					bodyShort: '[[notifications:user_flagged_post_in, ' + flaggingUser.username + ', ' + post.topic.title + ']]',
					bodyLong: post.content,
					pid: pid,
					nid: 'post_flag:' + pid + ':uid:' + socket.uid,
					from: socket.uid
				}, function(err, notification) {
					if (err || !notification) {
						return next(err);
					}

					plugins.fireHook('action:post.flag', {post: post, flaggingUser: flaggingUser});
					notifications.push(notification, results.admins.concat(results.moderators), next);
				});
			}
		], callback);
	};
};