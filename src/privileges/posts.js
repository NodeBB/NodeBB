
'use strict';

var async = require('async'),

	posts = require('../posts'),
	user = require('../user'),
	helpers = require('./helpers'),
	groups = require('../groups'),
	categories = require('../categories');

module.exports = function(privileges) {

	privileges.posts = {};

	privileges.posts.get = function(pid, uid, callback) {

		async.parallel({
			isOwner: function(next) {
				posts.isOwner(pid, uid, next);
			},
			manage_content: function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_content', uid, next);
			},
			manage_topic: function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_topic', uid, next);
			},
			isAdministrator: function(next) {
				user.isAdministrator(uid, next);
			},
			isModerator: function(next) {
				posts.getCidByPid(pid, function(err, cid) {
					if (err) {
						return next(err);
					}
					user.isModerator(uid, cid, next);
				});
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}

			var editable = results.isAdministrator || results.isModerator || results.manage_content || results.manage_topic || results.isOwner;

			callback(null, {
				meta: {
					editable: editable,
					view_deleted: editable,
					move: results.isAdministrator || results.isModerator
				}
			});
		});
	};

	privileges.posts.canRead = function(pid, uid, callback) {
		posts.getCidByPid(pid, function(err, cid) {
			if (err) {
				return callback(err);
			}

			async.some([
				function(next) {
					helpers.allowedTo('read', uid, cid, next);
				},
				function(next) {
					user.isModerator(uid, cid, next);
				},
				function(next) {
					user.isAdministrator(uid, next);
				}
			], function(task, next) {
				task(function(err, result) {
					next(!err && result);
				});
			}, function(result) {
				callback(null, result);
			});
		});
	};

	privileges.posts.canEdit = function(pid, uid, callback) {
		async.some([
			function(next) {
				posts.isOwner(pid, uid, next);
			},
			function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_content', uid, next);
			},
			function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_topic', uid, next);
			},
			function(next) {
				posts.getCidByPid(pid, function(err, cid) {
					if (err) {
						return next(err);
					}
					user.isModerator(uid, cid, next);
				});
			},
			function(next) {
				user.isAdministrator(uid, next);
			}
		], function(task, next) {
			task(function(err, result) {
				next(!err && result);
			});
		}, function(result) {
			callback(null, result);
		});
	};
};
