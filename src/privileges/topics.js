
'use strict';

var async = require('async'),

	db = require('../database'),
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
					helpers.isUserAllowedTo('topics:reply', uid, [cid], next);
				},
				read: function(next) {
					helpers.isUserAllowedTo('read', uid, [cid], next);
				},
				isOwner: function(next) {
					topics.isOwner(tid, uid, next);
				},
				manage_topic: function(next) {
					helpers.hasEnoughReputationFor('privileges:manage_topic', uid, next);
				},
				isAdministrator: function(next) {
					user.isAdministrator(uid, next);
				},
				isModerator: function(next) {
					user.isModerator(uid, cid, next);
				},
				disabled: function(next) {
					categories.getCategoryField(cid, 'disabled', next);
				}
			}, function(err, results) {
				if(err) {
					return callback(err);
				}
				var disabled = parseInt(results.disabled, 10) === 1;
				var	isAdminOrMod = results.isAdministrator || results.isModerator;
				var editable = isAdminOrMod || results.manage_topic;
				var deletable = isAdminOrMod || results.isOwner;

				callback(null, {
					'topics:reply': results['topics:reply'][0],
					read: results.read[0],
					view_thread_tools: editable || deletable,
					editable: editable,
					deletable: deletable,
					view_deleted: isAdminOrMod || results.manage_topic || results.isOwner,
					disabled: disabled
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

	privileges.topics.filter = function(privilege, tids, uid, callback) {
		if (!tids.length) {
			return callback(null, []);
		}

		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});

		db.getObjectsFields(keys, ['tid', 'cid'], function(err, topics) {
			if (err) {
				return callback(err);
			}

			var cids = topics.map(function(topic) {
				return topic.cid;
			});

			privileges.categories.filterCids(privilege, cids, uid, function(err, cids) {
				if (err) {
					return callback(err);
				}

				tids = topics.filter(function(topic) {
					return cids.indexOf(topic.cid) !== -1;
				}).map(function(topic) {
					return topic.tid;
				});
				callback(null, tids);
			});
		});
	};

	privileges.topics.canEdit = function(tid, uid, callback) {
		helpers.some([
			function(next) {
				topics.isOwner(tid, uid, next);
			},
			function(next) {
				helpers.hasEnoughReputationFor('privileges:manage_topic', uid, next);
			},
			function(next) {
				isAdminOrMod(tid, uid, next);
			}
		], callback);
	};

	privileges.topics.canMove = function(tid, uid, callback) {
		isAdminOrMod(tid, uid, callback);
	};

	function isAdminOrMod(tid, uid, callback) {
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
	}
};
