
'use strict';

var async = require('async'),

	topics = require('../topics'),
	user = require('../user'),
	helpers = require('./helpers'),
	groups = require('../groups'),
	categories = require('../categories');

module.exports = function(privileges) {

	privileges.topics = {};

	privileges.topics.get = function(tid, uid, callback) {

		topics.getTopicField(tid, 'cid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			async.parallel({
				'topics:reply': function(next) {
					helpers.allowedTo('topics:reply', uid, cid, next);
				},
				read: function(next) {
					helpers.allowedTo('read', uid, cid, next);
				},
				manage_topic: function(next) {
					helpers.hasEnoughReputationFor('privileges:manage_topic', uid, next);
				},
				isAdministrator: function(next) {
					user.isAdministrator(uid, next);
				},
				isModerator: function(next) {
					user.isModerator(uid, cid, next);
				}
			}, function(err, results) {
				if(err) {
					return callback(err);
				}

				var editable = results.isAdministrator || results.isModerator || results.manage_topic;

				callback(null, {
					'topics:reply': results['topics:reply'],
					editable: editable,
					view_deleted: editable,
					read: results.read
				});
			});
		});
	};

	privileges.topics.can = function(privilege, tid, uid, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			privileges.categories.can(privilege, cid, uid, callback);
		});
	};

	privileges.topics.canEdit = function(tid, uid, callback) {
		helpers.some([
			function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_topic', uid, next);
			},
			function(next) {
				topics.getTopicField(tid, 'cid', function(err, cid) {
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

	privileges.topics.canMove = function(tid, uid, callback) {
		helpers.some([
			function(next) {
				topics.getTopicField(tid, 'cid', function(err, cid) {
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
