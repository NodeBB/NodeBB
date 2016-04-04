'use strict';

var async = require('async');
var S = require('string');

var user = require('../../user');
var groups = require('../../groups');
var posts = require('../../posts');
var topics = require('../../topics');
var privileges = require('../../privileges');
var notifications = require('../../notifications');
var plugins = require('../../plugins');
var meta = require('../../meta');

module.exports = function(SocketPosts) {

	SocketPosts.flag = function(socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		if (!data || !data.pid || !data.reason) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var flaggingUser = {},
			post;

		async.waterfall([
			function (next) {
				posts.getPostFields(data.pid, ['pid', 'tid', 'uid', 'content', 'deleted'], next);
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
						user.getUserFields(socket.uid, ['username', 'reputation', 'banned'], next);
					}
				}, next);
			},
			function (user, next) {
				if (!user.isAdminOrMod && parseInt(user.userData.reputation, 10) < parseInt(meta.config['privileges:flag'] || 1, 10)) {
					return next(new Error('[[error:not-enough-reputation-to-flag]]'));
				}

				if (parseInt(user.banned, 10) === 1) {
					return next(new Error('[[error:user-banned]]'));
				}

				flaggingUser = user.userData;
				flaggingUser.uid = socket.uid;

				posts.flag(post, socket.uid, data.reason, next);
			},
			function (next) {
				async.parallel({
					post: function(next) {
						posts.parsePost(post, next);
					},
					admins: function(next) {
						groups.getMembers('administrators', 0, -1, next);
					},
					globalMods: function (next) {
						groups.getMembers('Global Moderators', 0, -1, next);
					},
					moderators: function(next) {
						groups.getMembers('cid:' + post.topic.cid + ':privileges:mods', 0, -1, next);
					}
				}, next);
			},
			function (results, next) {
				var title = S(post.topic.title).decodeHTMLEntities().s;
				var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

				notifications.create({
					bodyShort: '[[notifications:user_flagged_post_in, ' + flaggingUser.username + ', ' + titleEscaped + ']]',
					bodyLong: post.content,
					pid: data.pid,
					nid: 'post_flag:' + data.pid + ':uid:' + socket.uid,
					from: socket.uid,
					mergeId: 'notifications:user_flagged_post_in|' + data.pid,
					topicTitle: post.topic.title
				}, function(err, notification) {
					if (err || !notification) {
						return next(err);
					}

					plugins.fireHook('action:post.flag', {post: post, flaggingUser: flaggingUser});
					notifications.push(notification, results.admins.concat(results.moderators).concat(results.globalMods), next);
				});
			}
		], callback);
	};

	SocketPosts.dismissFlag = function(socket, pid, callback) {
		if (!pid || !socket.uid) {
			return callback('[[error:invalid-data]]');
		}
		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(socket.uid, next);
			},
			function (isAdminOrGlobalModerator, next) {
				if (!isAdminOrGlobalModerator) {
					return next(new Error('[[no-privileges]]'));
				}
				posts.dismissFlag(pid, next);
			}
		], callback);
	};

	SocketPosts.dismissAllFlags = function(socket, data, callback) {
		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(socket.uid, next);
			},
			function (isAdminOrGlobalModerator, next) {
				if (!isAdminOrGlobalModerator) {
					return next(new Error('[[no-privileges]]'));
				}
				posts.dismissAllFlags(next);
			}
		], callback);
	};

	SocketPosts.getMoreFlags = function(socket, data, callback) {
		if (!data || !parseInt(data.after, 10)) {
			return callback('[[error:invalid-data]]');
		}
		var sortBy = data.sortBy || 'count';
		var byUsername = data.byUsername ||  '';
		var start = parseInt(data.after, 10);
		var stop = start + 19;

		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(socket.uid, next);
			},
			function (isAdminOrGlobalModerator, next) {
				if (!isAdminOrGlobalModerator) {
					return next(new Error('[[no-privileges]]'));
				}

				if (byUsername) {
					posts.getUserFlags(byUsername, sortBy, socket.uid, start, stop, next);
				} else {
					var set = sortBy === 'count' ? 'posts:flags:count' : 'posts:flagged';
					posts.getFlags(set, socket.uid, start, stop, next);
				}
			},
			function (posts, next) {
				next(null, {posts: posts, next: stop + 1});
			},
		], callback);
	};
};
