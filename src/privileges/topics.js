
'use strict';

const _ = require('lodash');

const meta = require('../meta');
const topics = require('../topics');
const user = require('../user');
const helpers = require('./helpers');
const categories = require('../categories');
const plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.topics = {};

	privileges.topics.get = async function (tid, uid) {
		uid = parseInt(uid, 10);

		const privs = [
			'topics:reply', 'topics:read', 'topics:tag',
			'topics:delete', 'posts:edit', 'posts:history',
			'posts:delete', 'posts:view_deleted', 'read', 'purge',
		];
		const topicData = await topics.getTopicFields(tid, ['cid', 'uid', 'locked', 'deleted']);
		const [userPrivileges, isAdministrator, isModerator, disabled] = await Promise.all([
			helpers.isAllowedTo(privs, uid, topicData.cid),
			user.isAdministrator(uid),
			user.isModerator(uid, topicData.cid),
			categories.getCategoryField(topicData.cid, 'disabled'),
		]);
		const privData = _.zipObject(privs, userPrivileges);
		const isOwner = uid > 0 && uid === topicData.uid;
		const isAdminOrMod = isAdministrator || isModerator;
		const editable = isAdminOrMod;
		const deletable = (privData['topics:delete'] && (isOwner || isModerator)) || isAdministrator;

		return await plugins.hooks.fire('filter:privileges.topics.get', {
			'topics:reply': (privData['topics:reply'] && ((!topicData.locked && !topicData.deleted) || isModerator)) || isAdministrator,
			'topics:read': privData['topics:read'] || isAdministrator,
			'topics:tag': privData['topics:tag'] || isAdministrator,
			'topics:delete': (privData['topics:delete'] && (isOwner || isModerator)) || isAdministrator,
			'posts:edit': (privData['posts:edit'] && (!topicData.locked || isModerator)) || isAdministrator,
			'posts:history': privData['posts:history'] || isAdministrator,
			'posts:delete': (privData['posts:delete'] && (!topicData.locked || isModerator)) || isAdministrator,
			'posts:view_deleted': privData['posts:view_deleted'] || isAdministrator,
			read: privData.read || isAdministrator,
			purge: (privData.purge && (isOwner || isModerator)) || isAdministrator,

			view_thread_tools: editable || deletable,
			editable: editable,
			deletable: deletable,
			view_deleted: isAdminOrMod || isOwner,
			isAdminOrMod: isAdminOrMod,
			disabled: disabled,
			tid: tid,
			uid: uid,
		});
	};

	privileges.topics.can = async function (privilege, tid, uid) {
		const cid = await topics.getTopicField(tid, 'cid');
		return await privileges.categories.can(privilege, cid, uid);
	};

	privileges.topics.filterTids = async function (privilege, tids, uid) {
		if (!Array.isArray(tids) || !tids.length) {
			return [];
		}

		const topicsData = await topics.getTopicsFields(tids, ['tid', 'cid', 'deleted']);
		const cids = _.uniq(topicsData.map(topic => topic.cid));
		const results = await privileges.categories.getBase(privilege, cids, uid);

		const allowedCids = cids.filter((cid, index) => !results.categories[index].disabled && (results.allowedTo[index] || results.isAdmin));

		const cidsSet = new Set(allowedCids);
		const canViewDeleted = _.zipObject(cids, results.view_deleted);

		tids = topicsData.filter(t => cidsSet.has(t.cid) &&	(!t.deleted || canViewDeleted[t.cid] || results.isAdmin)).map(t => t.tid);

		const data = await plugins.hooks.fire('filter:privileges.topics.filter', {
			privilege: privilege,
			uid: uid,
			tids: tids,
		});
		return data ? data.tids : [];
	};

	privileges.topics.filterUids = async function (privilege, tid, uids) {
		if (!Array.isArray(uids) || !uids.length) {
			return [];
		}

		uids = _.uniq(uids);
		const topicData = await topics.getTopicFields(tid, ['tid', 'cid', 'deleted']);
		const [disabled, allowedTo, isAdmins] = await Promise.all([
			categories.getCategoryField(topicData.cid, 'disabled'),
			helpers.isUsersAllowedTo(privilege, uids, topicData.cid),
			user.isAdministrator(uids),
		]);
		return uids.filter(function (uid, index) {
			return !disabled &&
				((allowedTo[index] && !topicData.deleted) || isAdmins[index]);
		});
	};

	privileges.topics.canPurge = async function (tid, uid) {
		const cid = await topics.getTopicField(tid, 'cid');
		const [purge, owner, isAdmin, isModerator] = await Promise.all([
			privileges.categories.isUserAllowedTo('purge', cid, uid),
			topics.isOwner(tid, uid),
			privileges.users.isAdministrator(uid),
			privileges.users.isModerator(uid, cid),
		]);
		return (purge && (owner || isModerator)) || isAdmin;
	};

	privileges.topics.canDelete = async function (tid, uid) {
		const topicData = await topics.getTopicFields(tid, ['uid', 'cid', 'postcount', 'deleterUid']);
		const [isModerator, isAdministrator, isOwner, allowedTo] = await Promise.all([
			user.isModerator(uid, topicData.cid),
			user.isAdministrator(uid),
			topics.isOwner(tid, uid),
			helpers.isAllowedTo('topics:delete', uid, [topicData.cid]),
		]);

		if (isAdministrator) {
			return true;
		}

		const preventTopicDeleteAfterReplies = meta.config.preventTopicDeleteAfterReplies;
		if (!isModerator && preventTopicDeleteAfterReplies && (topicData.postcount - 1) >= preventTopicDeleteAfterReplies) {
			const langKey = preventTopicDeleteAfterReplies > 1 ?
				`[[error:cant-delete-topic-has-replies, ${meta.config.preventTopicDeleteAfterReplies}]]` :
				'[[error:cant-delete-topic-has-reply]]';
			throw new Error(langKey);
		}

		const deleterUid = topicData.deleterUid;
		return allowedTo[0] && ((isOwner && (deleterUid === 0 || deleterUid === topicData.uid)) || isModerator);
	};

	privileges.topics.canEdit = async function (tid, uid) {
		return await privileges.topics.isOwnerOrAdminOrMod(tid, uid);
	};

	privileges.topics.isOwnerOrAdminOrMod = async function (tid, uid) {
		const [isOwner, isAdminOrMod] = await Promise.all([
			topics.isOwner(tid, uid),
			privileges.topics.isAdminOrMod(tid, uid),
		]);
		return isOwner || isAdminOrMod;
	};

	privileges.topics.isAdminOrMod = async function (tid, uid) {
		if (parseInt(uid, 10) <= 0) {
			return false;
		}
		const cid = await topics.getTopicField(tid, 'cid');
		return await privileges.categories.isAdminOrMod(cid, uid);
	};
};
