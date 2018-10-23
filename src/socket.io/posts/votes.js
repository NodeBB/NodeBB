'use strict';

var async = require('async');

var db = require('../../database');
var user = require('../../user');
var posts = require('../../posts');
var privileges = require('../../privileges');
var meta = require('../../meta');
var helpers = require('./helpers');

module.exports = function (SocketPosts) {
	SocketPosts.getVoters = function (socket, data, callback) {
		if (!data || !data.pid || !data.cid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				if (meta.config.votesArePublic) {
					return next(null, true);
				}
				privileges.categories.isAdminOrMod(data.cid, socket.uid, next);
			},
			function (isAdminOrMod, next) {
				if (!isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				async.parallel({
					upvoteUids: function (next) {
						db.getSetMembers('pid:' + data.pid + ':upvote', next);
					},
					downvoteUids: function (next) {
						db.getSetMembers('pid:' + data.pid + ':downvote', next);
					},
				}, next);
			},
			function (results, next) {
				async.parallel({
					upvoters: function (next) {
						user.getUsersFields(results.upvoteUids, ['username', 'userslug', 'picture'], next);
					},
					upvoteCount: function (next) {
						next(null, results.upvoteUids.length);
					},
					downvoters: function (next) {
						user.getUsersFields(results.downvoteUids, ['username', 'userslug', 'picture'], next);
					},
					downvoteCount: function (next) {
						next(null, results.downvoteUids.length);
					},
				}, next);
			},
		], callback);
	};

	SocketPosts.getUpvoters = function (socket, pids, callback) {
		if (!Array.isArray(pids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				posts.getUpvotedUidsByPids(pids, next);
			},
			function (data, next) {
				if (!data.length) {
					return callback(null, []);
				}

				async.map(data, function (uids, next) {
					var otherCount = 0;
					if (uids.length > 6) {
						otherCount = uids.length - 5;
						uids = uids.slice(0, 5);
					}
					user.getUsernamesByUids(uids, function (err, usernames) {
						next(err, {
							otherCount: otherCount,
							usernames: usernames,
						});
					});
				}, next);
			},
		], callback);
	};

	SocketPosts.upvote = function (socket, data, callback) {
		helpers.postCommand(socket, 'upvote', 'voted', 'notifications:upvoted_your_post_in', data, callback);
	};

	SocketPosts.downvote = function (socket, data, callback) {
		helpers.postCommand(socket, 'downvote', 'voted', '', data, callback);
	};

	SocketPosts.unvote = function (socket, data, callback) {
		helpers.postCommand(socket, 'unvote', 'voted', '', data, callback);
	};
};
