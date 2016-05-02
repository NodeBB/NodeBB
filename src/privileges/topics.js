
'use strict';

var async = require('async');

var topics = require('../topics');
var user = require('../user');
var helpers = require('./helpers');
var categories = require('../categories');
var plugins = require('../plugins');

module.exports = function(privileges) {

	privileges.topics = {};

	privileges.topics.get = function(tid, uid, callback) {
		var topic;
		async.waterfall([
			async.apply(topics.getTopicFields, tid, ['cid', 'uid', 'locked']),
			function(_topic, next) {
				topic = _topic;
				async.parallel({
					'topics:reply': async.apply(helpers.isUserAllowedTo, 'topics:reply', uid, [topic.cid]),
					read: async.apply(helpers.isUserAllowedTo, 'read', uid, [topic.cid]),
					isOwner: function(next) {
						next(null, parseInt(uid, 10) === parseInt(topic.uid, 10));
					},
					isAdministrator: async.apply(user.isAdministrator, uid),
					isModerator: async.apply(user.isModerator, uid, topic.cid),
					disabled: async.apply(categories.getCategoryField, topic.cid, 'disabled')
				}, next);
			}
		], function(err, results) {
			if (err) {
				return callback(err);
			}

			var disabled = parseInt(results.disabled, 10) === 1;
			var locked = parseInt(topic.locked, 10) === 1;
			var isAdminOrMod = results.isAdministrator || results.isModerator;
			var editable = isAdminOrMod;
			var deletable = isAdminOrMod || results.isOwner;

			plugins.fireHook('filter:privileges.topics.get', {
				'topics:reply': (results['topics:reply'][0] && !locked) || isAdminOrMod,
				read: results.read[0] || isAdminOrMod,
				view_thread_tools: editable || deletable,
				editable: editable,
				deletable: deletable,
				view_deleted: isAdminOrMod || results.isOwner,
				isAdminOrMod: isAdminOrMod,
				disabled: disabled,
				tid: tid,
				uid: uid
			}, callback);
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

	privileges.topics.filterTids = function(privilege, tids, uid, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
		var cids;
		var topicsData;
		async.waterfall([
			function(next) {
				topics.getTopicsFields(tids, ['tid', 'cid', 'deleted'], next);
			},
			function(_topicsData, next) {
				topicsData = _topicsData;
				cids = topicsData.map(function(topic) {
					return topic.cid;
				}).filter(function(cid, index, array) {
					return cid && array.indexOf(cid) === index;
				});

				privileges.categories.getBase(privilege, cids, uid, next);
			},
			function(results, next) {

				var isModOf = {};
				cids = cids.filter(function(cid, index) {
					isModOf[cid] = results.isModerators[index];
					return !results.categories[index].disabled &&
						(results.allowedTo[index] || results.isAdmin || results.isModerators[index]);
				});

				tids = topicsData.filter(function(topic) {
					return cids.indexOf(topic.cid) !== -1 &&
						(parseInt(topic.deleted, 10) !== 1 || results.isAdmin || isModOf[topic.cid]);
				}).map(function(topic) {
					return topic.tid;
				});

				plugins.fireHook('filter:privileges.topics.filter', {
					privilege: privilege,
					uid: uid,
					tids: tids
				}, function(err, data) {
					next(err, data ? data.tids : null);
				});
			}
		], callback);
	};

	privileges.topics.filterUids = function(privilege, tid, uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		uids = uids.filter(function(uid, index, array) {
			return array.indexOf(uid) === index;
		});

		async.waterfall([
			function(next) {
				topics.getTopicFields(tid, ['tid', 'cid', 'deleted'], next);
			},
			function(topicData, next) {
				async.parallel({
					disabled: function(next) {
						categories.getCategoryField(topicData.cid, 'disabled', next);
					},
					allowedTo: function(next) {
						helpers.isUsersAllowedTo(privilege, uids, topicData.cid, next);
					},
					isModerators: function(next) {
						user.isModerator(uids, topicData.cid, next);
					},
					isAdmins: function(next) {
						user.isAdministrator(uids, next);
					}
				}, function(err, results) {
					if (err) {
						return next(err);
					}

					uids = uids.filter(function(uid, index) {
						return parseInt(results.disabled, 10) !== 1 &&
							((results.allowedTo[index] && parseInt(topicData.deleted, 10) !== 1) || results.isAdmins[index] || results.isModerators[index]);
					});

					next(null, uids);
				});
			}
		], callback);
	};

	privileges.topics.canPurge = function(tid, uid, callback) {
		async.waterfall([
			function (next) {
				topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				async.parallel({
					purge: async.apply(privileges.categories.isUserAllowedTo, 'purge', cid, uid),
					owner: async.apply(topics.isOwner, tid, uid),
					isAdminOrMod: async.apply(privileges.categories.isAdminOrMod, cid, uid)
				}, next);
			},
			function (results, next) {
				next(null, results.isAdminOrMod || (results.purge && results.owner));
			}
		], callback);
	};

	privileges.topics.canEdit = function(tid, uid, callback) {
		privileges.topics.isOwnerOrAdminOrMod(tid, uid, callback);
	};

	privileges.topics.isOwnerOrAdminOrMod = function(tid, uid, callback) {
		helpers.some([
			function(next) {
				topics.isOwner(tid, uid, next);
			},
			function(next) {
				privileges.topics.isAdminOrMod(tid, uid, next);
			}
		], callback);
	};


	privileges.topics.isAdminOrMod = function(tid, uid, callback) {
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
