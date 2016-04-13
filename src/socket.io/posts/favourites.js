'use strict';

var async = require('async');

var db = require('../../database');
var user = require('../../user');
var posts = require('../../posts');
var favourites = require('../../favourites');
var plugins = require('../../plugins');
var websockets = require('../index');
var privileges = require('../../privileges');
var socketHelpers = require('../helpers');

module.exports = function(SocketPosts) {
	SocketPosts.getVoters = function(socket, data, callback) {
		if (!data || !data.pid || !data.cid) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				privileges.categories.isAdminOrMod(data.cid, socket.uid, next);
			},
			function (isAdminOrMod, next) {
				if (!isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}

				async.parallel({
					upvoteUids: function(next) {
						db.getSetMembers('pid:' + data.pid + ':upvote', next);
					},
					downvoteUids: function(next) {
						db.getSetMembers('pid:' + data.pid + ':downvote', next);
					}
				}, next);
			},
			function (results, next) {
				async.parallel({
					upvoters: function(next) {
						user.getUsersFields(results.upvoteUids, ['username', 'userslug', 'picture'], next);
					},
					upvoteCount: function(next) {
						next(null, results.upvoteUids.length);
					},
					downvoters: function(next) {
						user.getUsersFields(results.downvoteUids, ['username', 'userslug', 'picture'], next);
					},
					downvoteCount: function(next) {
						next(null, results.downvoteUids.length);
					}
				}, next);
			}
		], callback);
	};

	SocketPosts.getUpvoters = function(socket, pids, callback) {
		if (!Array.isArray(pids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		favourites.getUpvotedUidsByPids(pids, function(err, data) {
			if (err || !Array.isArray(data) || !data.length) {
				return callback(err, []);
			}

			async.map(data, function(uids, next)  {
				var otherCount = 0;
				if (uids.length > 6) {
					otherCount = uids.length - 5;
					uids = uids.slice(0, 5);
				}
				user.getUsernamesByUids(uids, function(err, usernames) {
					next(err, {
						otherCount: otherCount,
						usernames: usernames
					});
				});
			}, callback);
		});
	};

	SocketPosts.upvote = function(socket, data, callback) {
		favouriteCommand(socket, 'upvote', 'voted', 'notifications:upvoted_your_post_in', data, callback);
	};

	SocketPosts.downvote = function(socket, data, callback) {
		favouriteCommand(socket, 'downvote', 'voted', '', data, callback);
	};

	SocketPosts.unvote = function(socket, data, callback) {
		favouriteCommand(socket, 'unvote', 'voted', '', data, callback);
	};

	SocketPosts.favourite = function(socket, data, callback) {
		favouriteCommand(socket, 'favourite', 'favourited', 'notifications:favourited_your_post_in', data, callback);
	};

	SocketPosts.unfavourite = function(socket, data, callback) {
		favouriteCommand(socket, 'unfavourite', 'favourited', '', data, callback);
	};

	function favouriteCommand(socket, command, eventName, notification, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:not-logged-in]]'))
		}
		if(!data || !data.pid || !data.room_id) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.parallel({
			exists: function(next) {
				posts.exists(data.pid, next);
			},
			deleted: function(next) {
				posts.getPostField(data.pid, 'deleted', next);
			}
		}, function(err, results) {
			if (err || !results.exists) {
				return callback(err || new Error('[[error:invalid-pid]]'));
			}

			if (parseInt(results.deleted, 10) === 1) {
				return callback(new Error('[[error:post-deleted]]'));
			}

			/*
			hooks:
				filter:post.upvote
				filter:post.downvote
				filter:post.unvote
				filter:post.favourite
				filter:post.unfavourite
			 */
			plugins.fireHook('filter:post.' + command, {data: data, uid: socket.uid}, function(err, filteredData) {
				if (err) {
					return callback(err);
				}

				executeFavouriteCommand(socket, command, eventName, notification, filteredData.data, callback);
			});
		});
	}

	function executeFavouriteCommand(socket, command, eventName, notification, data, callback) {
		favourites[command](data.pid, socket.uid, function(err, result) {
			if (err) {
				return callback(err);
			}

			if (result && eventName) {
				socket.emit('posts.' + command, result);
				websockets.in(data.room_id).emit('event:' + eventName, result);
			}

			if (result && notification) {
				socketHelpers.sendNotificationToPostOwner(data.pid, socket.uid, notification);
			}
			callback();
		});
	}
};