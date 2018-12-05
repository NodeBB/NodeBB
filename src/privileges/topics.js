
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
				var deletable = isAdminOrMod || (isOwner && privData['topics:delete']);
				var purge = results.isAdministrator || privData.purge;

				plugins.fireHook('filter:privileges.topics.get', {
					'topics:reply': (privData['topics:reply'] && !topic.locked && !topic.deleted) || isAdminOrMod,
					'topics:read': privData['topics:read'] || isAdminOrMod,
					'topics:tag': privData['topics:tag'] || isAdminOrMod,
					'topics:delete': (isOwner && privData['topics:delete']) || isAdminOrMod,
					'posts:edit': (privData['posts:edit'] && !topic.locked) || isAdminOrMod,
					'posts:history': privData['posts:history'] || isAdminOrMod,
					'posts:delete': (privData['posts:delete'] && !topic.locked) || isAdminOrMod,
					'posts:view_deleted': privData['posts:view_deleted'] || isAdminOrMod,
					read: privData.read || isAdminOrMod,
					view_thread_tools: editable || deletable,
					editable: editable,
					deletable: deletable,
					purge: purge,
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
				var isModOf = {};
				cids = cids.filter(function (cid, index) {
					isModOf[cid] = results.isModerators[index];
					return !results.categories[index].disabled &&
						(results.allowedTo[index] || results.isAdmin || results.isModerators[index]);
				});

				const cidsSet = new Set(cids);

				tids = topicsData.filter(function (topic) {
					return cidsSet.has(topic.cid) &&
						(!topic.deleted || results.isAdmin || isModOf[topic.cid]);
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
			return callback(null, []);
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
					isModerators: function (next) {
						user.isModerator(uids, topicData.cid, next);
					},
					isAdmins: function (next) {
						user.isAdministrator(uids, next);
					},
				}, next);
			},
			function (results, next) {
				uids = uids.filter(function (uid, index) {
					return !results.disabled &&
						((results.allowedTo[index] && !topicData.deleted) || results.isAdmins[index] || results.isModerators[index]);
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
					isAdminOrMod: async.apply(privileges.categories.isAdminOrMod, cid, uid),
				}, next);
			},
			function (results, next) {
				next(null, results.isAdminOrMod || (results.purge && results.owner));
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
				if (results.isModerator || results.isAdministrator) {
					return next(null, true);
				}

				var preventTopicDeleteAfterReplies = meta.config.preventTopicDeleteAfterReplies;
				if (preventTopicDeleteAfterReplies && (topicData.postcount - 1) >= preventTopicDeleteAfterReplies) {
					var langKey = preventTopicDeleteAfterReplies > 1 ?
						'[[error:cant-delete-topic-has-replies, ' + meta.config.preventTopicDeleteAfterReplies + ']]' :
						'[[error:cant-delete-topic-has-reply]]';
					return next(new Error(langKey));
				}

				if (!results['topics:delete'][0]) {
					return next(null, false);
				}

				next(null, results.isOwner);
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
