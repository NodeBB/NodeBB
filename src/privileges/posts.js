
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

	privileges.posts.can = function(privilege, pid, uid, callback) {
		posts.getCidByPid(pid, function(err, cid) {
			if (err) {
				return callback(err);
			}

			privileges.categories.can(privilege, cid, uid, callback);
		});
	};

	privileges.posts.canEdit = function(pid, uid, callback) {
		helpers.some([
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
		], callback);
	};

	privileges.posts.canMove = function(pid, uid, callback) {
		helpers.some([
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
		], callback);
	};
};
