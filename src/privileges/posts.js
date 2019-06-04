
'use strict';

var async = require('async');
var _ = require('lodash');

var meta = require('../meta');
var posts = require('../posts');
var topics = require('../topics');
var user = require('../user');
var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.posts = {};

	privileges.posts.get = function (pids, uid, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return setImmediate(callback, null, []);
		}
		let uniqueCids;
		let cids;
		async.waterfall([
			function (next) {
				posts.getCidsByPids(pids, next);
			},
			function (_cids, next) {
				cids = _cids;
				uniqueCids = _.uniq(cids);
				async.parallel({
					isAdmin: async.apply(user.isAdministrator, uid),
					isModerator: async.apply(user.isModerator, uid, uniqueCids),
					isOwner: async.apply(posts.isOwner, pids, uid),
					'topics:read': async.apply(helpers.isUserAllowedTo, 'topics:read', uid, uniqueCids),
					read: async.apply(helpers.isUserAllowedTo, 'read', uid, uniqueCids),
					'posts:edit': async.apply(helpers.isUserAllowedTo, 'posts:edit', uid, uniqueCids),
					'posts:history': async.apply(helpers.isUserAllowedTo, 'posts:history', uid, uniqueCids),
					'posts:view_deleted': async.apply(helpers.isUserAllowedTo, 'posts:view_deleted', uid, uniqueCids),
				}, next);
			},
			function (results, next) {
				const isModerator = _.zipObject(uniqueCids, results.isModerator);
				const privData = {};
				privData['topics:read'] = _.zipObject(uniqueCids, results['topics:read']);
				privData.read = _.zipObject(uniqueCids, results.read);
				privData['posts:edit'] = _.zipObject(uniqueCids, results['posts:edit']);
				privData['posts:history'] = _.zipObject(uniqueCids, results['posts:history']);
				privData['posts:view_deleted'] = _.zipObject(uniqueCids, results['posts:view_deleted']);

				var privileges = cids.map(function (cid, i) {
					var isAdminOrMod = results.isAdmin || isModerator[cid];
					var editable = (privData['posts:edit'][cid] && (results.isOwner[i] || results.isModerator)) || results.isAdmin;
					var viewDeletedPosts = results.isOwner[i] || privData['posts:view_deleted'][cid] || results.isAdmin;
					var viewHistory = results.isOwner[i] || privData['posts:history'][cid] || results.isAdmin;

					return {
						editable: editable,
						move: isAdminOrMod,
						isAdminOrMod: isAdminOrMod,
						'topics:read': privData['topics:read'][cid] || results.isAdmin,
						read: privData.read[cid] || results.isAdmin,
						'posts:history': viewHistory,
						'posts:view_deleted': viewDeletedPosts,
					};
				});

				next(null, privileges);
			},
		], callback);
	};

	privileges.posts.can = function (privilege, pid, uid, callback) {
		async.waterfall([
			function (next) {
				posts.getCidByPid(pid, next);
			},
			function (cid, next) {
				privileges.categories.can(privilege, cid, uid, next);
			},
		], callback);
	};

	privileges.posts.filter = function (privilege, pids, uid, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return setImmediate(callback, null, []);
		}
		var cids;
		var postData;
		var tids;
		var tidToTopic = {};

		pids = _.uniq(pids);

		async.waterfall([
			function (next) {
				posts.getPostsFields(pids, ['uid', 'tid', 'deleted'], next);
			},
			function (_posts, next) {
				postData = _posts;

				tids = _.uniq(_posts.map(post => post && post.tid).filter(Boolean));

				topics.getTopicsFields(tids, ['deleted', 'cid'], next);
			},
			function (topicData, next) {
				topicData.forEach(function (topic, index) {
					if (topic) {
						tidToTopic[tids[index]] = topic;
					}
				});

				cids = postData.map(function (post, index) {
					if (post) {
						post.pid = pids[index];
						post.topic = tidToTopic[post.tid];
					}
					return tidToTopic[post.tid] && tidToTopic[post.tid].cid;
				}).filter(cid => parseInt(cid, 10));

				cids = _.uniq(cids);

				privileges.categories.getBase(privilege, cids, uid, next);
			},
			function (results, next) {
				cids = cids.filter(function (cid, index) {
					return !results.categories[index].disabled &&
						(results.allowedTo[index] || results.isAdmin);
				});

				const cidsSet = new Set(cids);

				pids = postData.filter(function (post) {
					return post.topic && cidsSet.has(post.topic.cid) &&
						((!post.topic.deleted && !post.deleted) || results.isAdmin);
				}).map(post => post.pid);

				plugins.fireHook('filter:privileges.posts.filter', {
					privilege: privilege,
					uid: uid,
					pids: pids,
				}, function (err, data) {
					next(err, data ? data.pids : null);
				});
			},
		], callback);
	};

	privileges.posts.canEdit = function (pid, uid, callback) {
		let results;
		async.waterfall([
			function (next) {
				async.parallel({
					isAdmin: async.apply(privileges.users.isAdministrator, uid),
					isMod: async.apply(posts.isModerator, [pid], uid),
					owner: async.apply(posts.isOwner, pid, uid),
					edit: async.apply(privileges.posts.can, 'posts:edit', pid, uid),
					postData: async.apply(posts.getPostFields, pid, ['tid', 'timestamp']),
				}, next);
			},
			function (_results, next) {
				results = _results;
				results.isMod = results.isMod[0];
				if (results.isAdmin) {
					return callback(null, { flag: true });
				}

				if (!results.isMod && meta.config.postEditDuration && (Date.now() - results.postData.timestamp > meta.config.postEditDuration * 1000)) {
					return callback(null, { flag: false, message: '[[error:post-edit-duration-expired, ' + meta.config.postEditDuration + ']]' });
				}
				topics.isLocked(results.postData.tid, next);
			},
			function (isLocked, next) {
				if (!results.isMod && isLocked) {
					return callback(null, { flag: false, message: '[[error:topic-locked]]' });
				}

				results.pid = parseInt(pid, 10);
				results.uid = uid;

				plugins.fireHook('filter:privileges.posts.edit', results, next);
			},
			function (result, next) {
				next(null, { flag: result.edit && (result.owner || result.isMod), message: '[[error:no-privileges]]' });
			},
		], callback);
	};

	privileges.posts.canDelete = function (pid, uid, callback) {
		var postData;
		async.waterfall([
			function (next) {
				posts.getPostFields(pid, ['uid', 'tid', 'timestamp', 'deleterUid'], next);
			},
			function (_postData, next) {
				postData = _postData;
				async.parallel({
					isAdmin: async.apply(privileges.users.isAdministrator, uid),
					isMod: async.apply(posts.isModerator, [pid], uid),
					isLocked: async.apply(topics.isLocked, postData.tid),
					isOwner: async.apply(posts.isOwner, pid, uid),
					'posts:delete': async.apply(privileges.posts.can, 'posts:delete', pid, uid),
				}, next);
			},
			function (results, next) {
				results.isMod = results.isMod[0];
				if (results.isAdmin) {
					return next(null, { flag: true });
				}

				if (!results.isMod && results.isLocked) {
					return next(null, { flag: false, message: '[[error:topic-locked]]' });
				}

				var postDeleteDuration = meta.config.postDeleteDuration;
				if (!results.isMod && postDeleteDuration && (Date.now() - postData.timestamp > postDeleteDuration * 1000)) {
					return next(null, { flag: false, message: '[[error:post-delete-duration-expired, ' + meta.config.postDeleteDuration + ']]' });
				}
				var deleterUid = postData.deleterUid;
				var flag = results['posts:delete'] && ((results.isOwner && (deleterUid === 0 || deleterUid === postData.uid)) || results.isMod);
				next(null, { flag: flag, message: '[[error:no-privileges]]' });
			},
		], callback);
	};

	privileges.posts.canFlag = function (pid, uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					userReputation: async.apply(user.getUserField, uid, 'reputation'),
					isAdminOrMod: async.apply(isAdminOrMod, pid, uid),
				}, next);
			},
			function (results, next) {
				var minimumReputation = meta.config['min:rep:flag'];
				var canFlag = results.isAdminOrMod || (results.userReputation >= minimumReputation);
				next(null, { flag: canFlag });
			},
		], callback);
	};

	privileges.posts.canMove = function (pid, uid, callback) {
		async.waterfall([
			function (next) {
				posts.isMain(pid, next);
			},
			function (isMain, next) {
				if (isMain) {
					return next(new Error('[[error:cant-move-mainpost]]'));
				}
				isAdminOrMod(pid, uid, next);
			},
		], callback);
	};

	privileges.posts.canPurge = function (pid, uid, callback) {
		async.waterfall([
			function (next) {
				posts.getCidByPid(pid, next);
			},
			function (cid, next) {
				async.parallel({
					purge: async.apply(privileges.categories.isUserAllowedTo, 'purge', cid, uid),
					owner: async.apply(posts.isOwner, pid, uid),
					isAdmin: async.apply(privileges.users.isAdministrator, uid),
					isModerator: async.apply(privileges.users.isModerator, uid, cid),
				}, next);
			},
			function (results, next) {
				next(null, (results.purge && (results.owner || results.isModerator)) || results.isAdmin);
			},
		], callback);
	};

	function isAdminOrMod(pid, uid, callback) {
		helpers.some([
			function (next) {
				async.waterfall([
					function (next) {
						posts.getCidByPid(pid, next);
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
	}
};
