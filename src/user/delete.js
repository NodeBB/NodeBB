'use strict';

var async = require('async'),
	db = require('../database'),
	posts = require('../posts'),
	user = require('../user'),
	topics = require('../topics'),
	groups = require('../groups'),
	plugins = require('../plugins'),
	batch = require('../batch');

module.exports = function(User) {

	User.delete = function(uid, callback) {
		async.waterfall([
			function(next) {
				deletePosts(uid, next);
			},
			function(next) {
				deleteTopics(uid, next);
			},
			function(next) {
				User.deleteAccount(uid, next);
			}
		], callback);
	};

	function deletePosts(uid, callback) {
		deleteSortedSetElements('uid:' + uid + ':posts', posts.purge, callback);
	}

	function deleteTopics(uid, callback) {
		deleteSortedSetElements('uid:' + uid + ':topics', topics.purge, callback);
	}

	function deleteSortedSetElements(set, deleteMethod, callback) {
		batch.processSortedSet(set, function(err, ids, next) {
			if (err) {
				return callback(err);
			}

			async.eachLimit(ids, 10, deleteMethod, next);
		}, {alwaysStartAt: 0}, callback);
	}

	User.deleteAccount = function(uid, callback) {
		user.getUserFields(uid, ['username', 'userslug', 'email'], function(err, userData) {
			if (err)  {
				return callback(err);
			}

			async.parallel([
				function(next) {
					db.deleteObjectField('username:uid', userData.username, next);
				},
				function(next) {
					db.deleteObjectField('userslug:uid', userData.userslug, next);
				},
				function(next) {
					db.deleteObjectField('email:uid', userData.email.toLowerCase(), next);
				},
				function(next) {
					db.sortedSetsRemove(['users:joindate', 'users:postcount', 'users:reputation'], uid, next);
				},
				function(next) {
					var keys = [
						'uid:' + uid + ':notifications:read', 'uid:' + uid + ':notifications:unread',
						'uid:' + uid + ':favourites', 'user:' + uid + ':settings',
						'uid:' + uid + ':topics', 'uid:' + uid + ':posts',
						'uid:' + uid + ':chats', 'uid:' + uid + ':chats:unread',
						'uid:' + uid + ':ip', 'uid:' + uid + ':upvote', 'uid:' + uid + ':downvote',
						'uid:' + uid + ':ignored:cids'
					];
					db.deleteAll(keys, next);
				},
				function(next) {
					deleteUserFromFollowers(uid, next);
				},
				function(next) {
					groups.leaveAllGroups(uid, next);
				},
				function(next) {
					plugins.fireHook('filter:user.delete', uid, next);
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				async.parallel([
					function(next) {
						db.deleteAll(['followers:' + uid, 'following:' + uid, 'user:' + uid], next);
					},
					function(next) {
						db.decrObjectField('global', 'userCount', next);
					}
				], callback);
			});
		});
	};

	function deleteUserFromFollowers(uid, callback) {
		db.getSetMembers('followers:' + uid, function(err, uids) {
			if (err) {
				return callback(err);
			}

			var sets = uids.map(function(uid) {
				return 'following:' + uid;
			});

			db.setsRemove(sets, uid, callback);
		});
	}
};
