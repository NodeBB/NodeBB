
'use strict';

var async = require('async');
var _ = require('lodash');

var meta = require('../meta');
var topics = require('../topics');
var user = require('../user');
var helpers = require('./helpers');
var categories = require('../categories');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.topics = {};

	privileges.topics.get = function (tid, uid, callback) {
		uid = parseInt(uid, 10);
		var topic;
		var privs = [
			'topics:reply', 'topics:read', 'topics:tag',
			'topics:delete', 'posts:edit', 'posts:history',
			'posts:delete', 'posts:view_deleted', 'read', 'purge',
		];
		async.waterfall([
			async.apply(topics.getTopicFields, tid, ['cid', 'uid', 'locked', 'deleted']),
			function (_topic, next) {
				topic = _topic;
				async.parallel({
					privileges: async.apply(helpers.isUserAllowedTo, privs, uid, topic.cid),
					isAdministrator: async.apply(user.isAdministrator, uid),
					isModerator: async.apply(user.isModerator, uid, topic.cid),
					disabled: async.apply(categories.getCategoryField, topic.cid, 'disabled'),
				}, next);
			},
			function (results, next) {
				var privData = _.zipObject(privs, results.privileges);
				var isOwner = uid > 0 && uid === topic.uid;
				var isAdminOrMod = results.isAdministrator || results.isModerator;
				var editable = isAdminOrMod;
				var deletable = (privData['topics:delete'] && (isOwner || results.isModerator)) || results.isAdministrator;

				plugins.fireHook('filter:privileges.topics.get', {
					'topics:reply': (privData['topics:reply'] && ((!topic.locked && !topic.deleted) || results.isModerator)) || results.isAdministrator,
					'topics:read': privData['topics:read'] || results.isAdministrator,
					'topics:tag': privData['topics:tag'] || results.isAdministrator,
					'topics:delete': (privData['topics:delete'] && (isOwner || results.isModerator)) || results.isAdministrator,
					'posts:edit': (privData['posts:edit'] && (!topic.locked || results.isModerator)) || results.isAdministrator,
					'posts:history': privData['posts:history'] || results.isAdministrator,
					'posts:delete': (privData['posts:delete'] && (!topic.locked || results.isModerator)) || results.isAdministrator,
					'posts:view_deleted': privData['posts:view_deleted'] || results.isAdministrator,
					read: privData.read || results.isAdministrator,
					purge: (privData.purge && (isOwner || results.isModerator)) || results.isAdministrator,

					view_thread_tools: editable || deletable,
					editable: editable,
					deletable: deletable,
					view_deleted: isAdminOrMod || isOwner,
					isAdminOrMod: isAdminOrMod,
					disabled: results.disabled,
					tid: tid,
					uid: uid,
				}, next);
			},
		], callback);
	};

	privileges.topics.can = function (privilege, tid, uid, callback) {
		async.waterfall([
			function (next) {
				topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				privileges.categories.can(privilege, cid, uid, next);
			},
		], callback);
	};

	privileges.topics.filterTids = function (privilege, tids, uid, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
		var cids;
		var topicsData;
		async.waterfall([
			function (next) {
				topics.getTopicsFields(tids, ['tid', 'cid', 'deleted'], next);
			},
			function (_topicsData, next) {
				topicsData = _topicsData;
				cids = _.uniq(topicsData.map(topic => topic.cid));

				privileges.categories.getBase(privilege, cids, uid, next);
			},
			function (results, next) {
				cids = cids.filter(function (cid, index) {
					return !results.categories[index].disabled &&
						(results.allowedTo[index] || results.isAdmin);
				});

				const cidsSet = new Set(cids);

				tids = topicsData.filter(function (topic) {
					return cidsSet.has(topic.cid) &&
						(!topic.deleted || results.isAdmin);
				}).map(topic => topic.tid);

				plugins.fireHook('filter:privileges.topics.filter', {
					privilege: privilege,
					uid: uid,
					tids: tids,
				}, function (err, data) {
					next(err, data ? data.tids : null);
				});
			},
		], callback);
	};

	privileges.topics.filterUids = function (privilege, tid, uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return setImmediate(callback, null, []);
		}

		uids = _.uniq(uids);
		var topicData;
		async.waterfall([
			function (next) {
				topics.getTopicFields(tid, ['tid', 'cid', 'deleted'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				async.parallel({
					disabled: function (next) {
						categories.getCategoryField(topicData.cid, 'disabled', next);
					},
					allowedTo: function (next) {
						helpers.isUsersAllowedTo(privilege, uids, topicData.cid, next);
					},
					isAdmins: function (next) {
						user.isAdministrator(uids, next);
					},
				}, next);
			},
			function (results, next) {
				uids = uids.filter(function (uid, index) {
					return !results.disabled &&
						((results.allowedTo[index] && !topicData.deleted) || results.isAdmins[index]);
				});

				next(null, uids);
			},
		], callback);
	};

	privileges.topics.canPurge = function (tid, uid, callback) {
		async.waterfall([
			function (next) {
				topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				async.parallel({
					purge: async.apply(privileges.categories.isUserAllowedTo, 'purge', cid, uid),
					owner: async.apply(topics.isOwner, tid, uid),
					isAdmin: async.apply(privileges.users.isAdministrator, uid),
					isModerator: async.apply(privileges.users.isModerator, uid, cid),
				}, next);
			},
			function (results, next) {
				next(null, (results.purge && (results.owner || results.isModerator)) || results.isAdmin);
			},
		], callback);
	};

	privileges.topics.canDelete = function (tid, uid, callback) {
		var topicData;
		async.waterfall([
			function (next) {
				topics.getTopicFields(tid, ['cid', 'postcount'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				async.parallel({
					isModerator: async.apply(user.isModerator, uid, topicData.cid),
					isAdministrator: async.apply(user.isAdministrator, uid),
					isOwner: async.apply(topics.isOwner, tid, uid),
					'topics:delete': async.apply(helpers.isUserAllowedTo, 'topics:delete', uid, [topicData.cid]),
				}, next);
			},
			function (results, next) {
				if (results.isAdministrator) {
					return next(null, true);
				}

				var preventTopicDeleteAfterReplies = meta.config.preventTopicDeleteAfterReplies;
				if (!results.isModerator && preventTopicDeleteAfterReplies && (topicData.postcount - 1) >= preventTopicDeleteAfterReplies) {
					var langKey = preventTopicDeleteAfterReplies > 1 ?
						'[[error:cant-delete-topic-has-replies, ' + meta.config.preventTopicDeleteAfterReplies + ']]' :
						'[[error:cant-delete-topic-has-reply]]';
					return next(new Error(langKey));
				}

				next(null, results['topics:delete'][0] && (results.isOwner || results.isModerator));
			},
		], callback);
	};

	privileges.topics.canEdit = function (tid, uid, callback) {
		privileges.topics.isOwnerOrAdminOrMod(tid, uid, callback);
	};

	privileges.topics.isOwnerOrAdminOrMod = function (tid, uid, callback) {
		helpers.some([
			function (next) {
				topics.isOwner(tid, uid, next);
			},
			function (next) {
				privileges.topics.isAdminOrMod(tid, uid, next);
			},
		], callback);
	};

	privileges.topics.isAdminOrMod = function (tid, uid, callback) {
		helpers.some([
			function (next) {
				async.waterfall([
					function (next) {
						topics.getTopicField(tid, 'cid', next);
					},
					function (cid, next) {
						user.isModerator(uid, cid, next);
					},
				], next);
			},
			function (next) {
				user.isAdministrator(uid, next);
			},
		], callback);
	};
};
