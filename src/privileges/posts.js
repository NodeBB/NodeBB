
'use strict';

const _ = require('lodash');

const meta = require('../meta');
const posts = require('../posts');
const topics = require('../topics');
const user = require('../user');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');
const privsCategories = require('./categories');
const privsTopics = require('./topics');

const privsPosts = module.exports;

privsPosts.get = async function (pids, uid) {
	if (!Array.isArray(pids) || !pids.length) {
		return [];
	}
	const cids = await posts.getCidsByPids(pids);
	const uniqueCids = _.uniq(cids);

	const results = await utils.promiseParallel({
		isAdmin: user.isAdministrator(uid),
		isModerator: user.isModerator(uid, uniqueCids),
		isOwner: posts.isOwner(pids, uid),
		'topics:read': helpers.isAllowedTo('topics:read', uid, uniqueCids),
		read: helpers.isAllowedTo('read', uid, uniqueCids),
		'posts:edit': helpers.isAllowedTo('posts:edit', uid, uniqueCids),
		'posts:history': helpers.isAllowedTo('posts:history', uid, uniqueCids),
		'posts:view_deleted': helpers.isAllowedTo('posts:view_deleted', uid, uniqueCids),
	});

	const isModerator = _.zipObject(uniqueCids, results.isModerator);
	const privData = {};
	privData['topics:read'] = _.zipObject(uniqueCids, results['topics:read']);
	privData.read = _.zipObject(uniqueCids, results.read);
	privData['posts:edit'] = _.zipObject(uniqueCids, results['posts:edit']);
	privData['posts:history'] = _.zipObject(uniqueCids, results['posts:history']);
	privData['posts:view_deleted'] = _.zipObject(uniqueCids, results['posts:view_deleted']);

	const privileges = cids.map((cid, i) => {
		const isAdminOrMod = results.isAdmin || isModerator[cid];
		const editable = (privData['posts:edit'][cid] && (results.isOwner[i] || results.isModerator)) || results.isAdmin;
		const viewDeletedPosts = results.isOwner[i] || privData['posts:view_deleted'][cid] || results.isAdmin;
		const viewHistory = results.isOwner[i] || privData['posts:history'][cid] || results.isAdmin;

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

	return privileges;
};

privsPosts.can = async function (privilege, pid, uid) {
	const cid = await posts.getCidByPid(pid);
	return await privsCategories.can(privilege, cid, uid);
};

privsPosts.filter = async function (privilege, pids, uid) {
	if (!Array.isArray(pids) || !pids.length) {
		return [];
	}

	pids = _.uniq(pids);
	const postData = await posts.getPostsFields(pids, ['uid', 'tid', 'deleted']);
	const tids = _.uniq(postData.map(post => post && post.tid).filter(Boolean));
	const topicData = await topics.getTopicsFields(tids, ['deleted', 'scheduled', 'cid']);

	const tidToTopic = _.zipObject(tids, topicData);

	let cids = postData.map((post, index) => {
		if (post) {
			post.pid = pids[index];
			post.topic = tidToTopic[post.tid];
		}
		return tidToTopic[post.tid] && tidToTopic[post.tid].cid;
	}).filter(cid => parseInt(cid, 10));

	cids = _.uniq(cids);

	const results = await privsCategories.getBase(privilege, cids, uid);
	const allowedCids = cids.filter((cid, index) => !results.categories[index].disabled &&
			(results.allowedTo[index] || results.isAdmin));

	const cidsSet = new Set(allowedCids);
	const canViewDeleted = _.zipObject(cids, results.view_deleted);
	const canViewScheduled = _.zipObject(cids, results.view_scheduled);

	pids = postData.filter(post => (
		post.topic &&
		cidsSet.has(post.topic.cid) &&
		(privsTopics.canViewDeletedScheduled({
			deleted: post.topic.deleted || post.deleted,
			scheduled: post.topic.scheduled,
		}, {}, canViewDeleted[post.topic.cid], canViewScheduled[post.topic.cid]) || results.isAdmin)
	)).map(post => post.pid);

	const data = await plugins.hooks.fire('filter:privileges.posts.filter', {
		privilege: privilege,
		uid: uid,
		pids: pids,
	});

	return data ? data.pids : null;
};

privsPosts.canEdit = async function (pid, uid) {
	const results = await utils.promiseParallel({
		isAdmin: user.isAdministrator(uid),
		isMod: posts.isModerator([pid], uid),
		owner: posts.isOwner(pid, uid),
		edit: privsPosts.can('posts:edit', pid, uid),
		postData: posts.getPostFields(pid, ['tid', 'timestamp', 'deleted', 'deleterUid']),
		userData: user.getUserFields(uid, ['reputation']),
	});

	results.isMod = results.isMod[0];
	if (results.isAdmin) {
		return { flag: true };
	}

	if (
		!results.isMod &&
		meta.config.postEditDuration &&
		(Date.now() - results.postData.timestamp > meta.config.postEditDuration * 1000)
	) {
		return { flag: false, message: `[[error:post-edit-duration-expired, ${meta.config.postEditDuration}]]` };
	}
	if (
		!results.isMod &&
		meta.config.newbiePostEditDuration > 0 &&
		meta.config.newbieReputationThreshold > results.userData.reputation &&
		Date.now() - results.postData.timestamp > meta.config.newbiePostEditDuration * 1000
	) {
		return { flag: false, message: `[[error:post-edit-duration-expired, ${meta.config.newbiePostEditDuration}]]` };
	}

	const isLocked = await topics.isLocked(results.postData.tid);
	if (!results.isMod && isLocked) {
		return { flag: false, message: '[[error:topic-locked]]' };
	}

	if (!results.isMod && results.postData.deleted && parseInt(uid, 10) !== parseInt(results.postData.deleterUid, 10)) {
		return { flag: false, message: '[[error:post-deleted]]' };
	}

	results.pid = parseInt(pid, 10);
	results.uid = uid;

	const result = await plugins.hooks.fire('filter:privileges.posts.edit', results);
	return { flag: result.edit && (result.owner || result.isMod), message: '[[error:no-privileges]]' };
};

privsPosts.canDelete = async function (pid, uid) {
	const postData = await posts.getPostFields(pid, ['uid', 'tid', 'timestamp', 'deleterUid']);
	const results = await utils.promiseParallel({
		isAdmin: user.isAdministrator(uid),
		isMod: posts.isModerator([pid], uid),
		isLocked: topics.isLocked(postData.tid),
		isOwner: posts.isOwner(pid, uid),
		'posts:delete': privsPosts.can('posts:delete', pid, uid),
	});
	results.isMod = results.isMod[0];
	if (results.isAdmin) {
		return { flag: true };
	}

	if (!results.isMod && results.isLocked) {
		return { flag: false, message: '[[error:topic-locked]]' };
	}

	const { postDeleteDuration } = meta.config;
	if (!results.isMod && postDeleteDuration && (Date.now() - postData.timestamp > postDeleteDuration * 1000)) {
		return { flag: false, message: `[[error:post-delete-duration-expired, ${meta.config.postDeleteDuration}]]` };
	}
	const { deleterUid } = postData;
	const flag = results['posts:delete'] && ((results.isOwner && (deleterUid === 0 || deleterUid === postData.uid)) || results.isMod);
	return { flag: flag, message: '[[error:no-privileges]]' };
};

privsPosts.canFlag = async function (pid, uid) {
	const targetUid = await posts.getPostField(pid, 'uid');
	const [userReputation, isAdminOrModerator, targetPrivileged, reporterPrivileged] = await Promise.all([
		user.getUserField(uid, 'reputation'),
		isAdminOrMod(pid, uid),
		user.isPrivileged(targetUid),
		user.isPrivileged(uid),
	]);
	const minimumReputation = meta.config['min:rep:flag'];
	let canFlag = isAdminOrModerator || (userReputation >= minimumReputation);

	if (targetPrivileged && !reporterPrivileged) {
		canFlag = false;
	}

	return { flag: canFlag };
};

privsPosts.canMove = async function (pid, uid) {
	const isMain = await posts.isMain(pid);
	if (isMain) {
		throw new Error('[[error:cant-move-mainpost]]');
	}
	return await isAdminOrMod(pid, uid);
};

privsPosts.canPurge = async function (pid, uid) {
	const cid = await posts.getCidByPid(pid);
	const results = await utils.promiseParallel({
		purge: privsCategories.isUserAllowedTo('purge', cid, uid),
		owner: posts.isOwner(pid, uid),
		isAdmin: user.isAdministrator(uid),
		isModerator: user.isModerator(uid, cid),
	});
	return (results.purge && (results.owner || results.isModerator)) || results.isAdmin;
};

async function isAdminOrMod(pid, uid) {
	if (parseInt(uid, 10) <= 0) {
		return false;
	}
	const cid = await posts.getCidByPid(pid);
	return await privsCategories.isAdminOrMod(cid, uid);
}
