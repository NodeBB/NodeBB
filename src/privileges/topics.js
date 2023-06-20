
'use strict';

const _ = require('lodash');

const meta = require('../meta');
const topics = require('../topics');
const user = require('../user');
const helpers = require('./helpers');
const categories = require('../categories');
const plugins = require('../plugins');
const privsCategories = require('./categories');

const privsTopics = module.exports;

privsTopics.get = async function (tid, uid) {
	uid = parseInt(uid, 10);

	const privs = [
		'topics:reply', 'topics:read', 'topics:schedule', 'topics:tag',
		'topics:delete', 'posts:edit', 'posts:history',
		'posts:upvote', 'posts:downvote',
		'posts:delete', 'posts:view_deleted', 'read', 'purge',
	];
	const topicData = await topics.getTopicFields(tid, ['cid', 'uid', 'locked', 'deleted', 'scheduled']);
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
	const mayReply = privsTopics.canViewDeletedScheduled(topicData, {}, false, privData['topics:schedule']);

	return await plugins.hooks.fire('filter:privileges.topics.get', {
		'topics:reply': (privData['topics:reply'] && ((!topicData.locked && mayReply) || isModerator)) || isAdministrator,
		'topics:read': privData['topics:read'] || isAdministrator,
		'topics:schedule': privData['topics:schedule'] || isAdministrator,
		'topics:tag': privData['topics:tag'] || isAdministrator,
		'topics:delete': (privData['topics:delete'] && (isOwner || isModerator)) || isAdministrator,
		'posts:edit': (privData['posts:edit'] && (!topicData.locked || isModerator)) || isAdministrator,
		'posts:history': privData['posts:history'] || isAdministrator,
		'posts:upvote': privData['posts:upvote'] || isAdministrator,
		'posts:downvote': privData['posts:downvote'] || isAdministrator,
		'posts:delete': (privData['posts:delete'] && (!topicData.locked || isModerator)) || isAdministrator,
		'posts:view_deleted': privData['posts:view_deleted'] || isAdministrator,
		read: privData.read || isAdministrator,
		purge: (privData.purge && (isOwner || isModerator)) || isAdministrator,

		view_thread_tools: editable || deletable,
		editable: editable,
		deletable: deletable,
		view_deleted: isAdminOrMod || isOwner || privData['posts:view_deleted'],
		view_scheduled: privData['topics:schedule'] || isAdministrator,
		isAdminOrMod: isAdminOrMod,
		disabled: disabled,
		tid: tid,
		uid: uid,
	});
};

privsTopics.can = async function (privilege, tid, uid) {
	const cid = await topics.getTopicField(tid, 'cid');
	return await privsCategories.can(privilege, cid, uid);
};

privsTopics.filterTids = async function (privilege, tids, uid) {
	if (!Array.isArray(tids) || !tids.length) {
		return [];
	}

	const topicsData = await topics.getTopicsFields(tids, ['tid', 'cid', 'deleted', 'scheduled']);
	const cids = _.uniq(topicsData.map(topic => topic.cid));
	const results = await privsCategories.getBase(privilege, cids, uid);

	const allowedCids = cids.filter((cid, index) => (
		!results.categories[index].disabled &&
		(results.allowedTo[index] || results.isAdmin)
	));

	const cidsSet = new Set(allowedCids);
	const canViewDeleted = _.zipObject(cids, results.view_deleted);
	const canViewScheduled = _.zipObject(cids, results.view_scheduled);

	tids = topicsData.filter(t => (
		cidsSet.has(t.cid) &&
		(results.isAdmin || privsTopics.canViewDeletedScheduled(t, {}, canViewDeleted[t.cid], canViewScheduled[t.cid]))
	)).map(t => t.tid);

	const data = await plugins.hooks.fire('filter:privileges.topics.filter', {
		privilege: privilege,
		uid: uid,
		tids: tids,
	});
	return data ? data.tids : [];
};

privsTopics.filterUids = async function (privilege, tid, uids) {
	if (!Array.isArray(uids) || !uids.length) {
		return [];
	}

	uids = _.uniq(uids);
	const topicData = await topics.getTopicFields(tid, ['tid', 'cid', 'deleted', 'scheduled']);
	const [disabled, allowedTo, isAdmins] = await Promise.all([
		categories.getCategoryField(topicData.cid, 'disabled'),
		helpers.isUsersAllowedTo(privilege, uids, topicData.cid),
		user.isAdministrator(uids),
	]);

	if (topicData.scheduled) {
		const canViewScheduled = await helpers.isUsersAllowedTo('topics:schedule', uids, topicData.cid);
		uids = uids.filter((uid, index) => canViewScheduled[index]);
	}

	return uids.filter((uid, index) => !disabled &&
			((allowedTo[index] && (topicData.scheduled || !topicData.deleted)) || isAdmins[index]));
};

privsTopics.canPurge = async function (tid, uid) {
	const cid = await topics.getTopicField(tid, 'cid');
	const [purge, owner, isAdmin, isModerator] = await Promise.all([
		privsCategories.isUserAllowedTo('purge', cid, uid),
		topics.isOwner(tid, uid),
		user.isAdministrator(uid),
		user.isModerator(uid, cid),
	]);
	return (purge && (owner || isModerator)) || isAdmin;
};

privsTopics.canDelete = async function (tid, uid) {
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

	const { preventTopicDeleteAfterReplies } = meta.config;
	if (!isModerator && preventTopicDeleteAfterReplies && (topicData.postcount - 1) >= preventTopicDeleteAfterReplies) {
		const langKey = preventTopicDeleteAfterReplies > 1 ?
			`[[error:cant-delete-topic-has-replies, ${meta.config.preventTopicDeleteAfterReplies}]]` :
			'[[error:cant-delete-topic-has-reply]]';
		throw new Error(langKey);
	}

	const { deleterUid } = topicData;
	return allowedTo[0] && ((isOwner && (deleterUid === 0 || deleterUid === topicData.uid)) || isModerator);
};

privsTopics.canEdit = async function (tid, uid) {
	return await privsTopics.isOwnerOrAdminOrMod(tid, uid);
};

privsTopics.isOwnerOrAdminOrMod = async function (tid, uid) {
	const [isOwner, isAdminOrMod] = await Promise.all([
		topics.isOwner(tid, uid),
		privsTopics.isAdminOrMod(tid, uid),
	]);
	return isOwner || isAdminOrMod;
};

privsTopics.isAdminOrMod = async function (tid, uid) {
	if (parseInt(uid, 10) <= 0) {
		return false;
	}
	const cid = await topics.getTopicField(tid, 'cid');
	return await privsCategories.isAdminOrMod(cid, uid);
};

privsTopics.canViewDeletedScheduled = function (topic, privileges = {}, viewDeleted = false, viewScheduled = false) {
	if (!topic) {
		return false;
	}
	const { deleted = false, scheduled = false } = topic;
	const { view_deleted = viewDeleted, view_scheduled = viewScheduled } = privileges;

	// conceptually exclusive, scheduled topics deemed to be not deleted (they can only be purged)
	if (scheduled) {
		return view_scheduled;
	} else if (deleted) {
		return view_deleted;
	}

	return true;
};
