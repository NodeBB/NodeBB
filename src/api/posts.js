'use strict';

const validator = require('validator');
const _ = require('lodash');

const db = require('../database');
const utils = require('../utils');
const user = require('../user');
const posts = require('../posts');
const topics = require('../topics');
const groups = require('../groups');
const plugins = require('../plugins');
const meta = require('../meta');
const events = require('../events');
const privileges = require('../privileges');
const activitypub = require('../activitypub');
const apiHelpers = require('./helpers');
const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');
const translator = require('../translator');
const notifications = require('../notifications');

const postsAPI = module.exports;

postsAPI.get = async function (caller, data) {
	const [userPrivileges, post, voted] = await Promise.all([
		privileges.posts.get([data.pid], caller.uid),
		posts.getPostData(data.pid),
		posts.hasVoted(data.pid, caller.uid),
	]);
	const userPrivilege = userPrivileges[0];

	if (!post || !userPrivilege.read || !userPrivilege['topics:read']) {
		return null;
	}

	Object.assign(post, voted);
	post.ip = userPrivilege.isAdminOrMod ? post.ip : undefined;

	const selfPost = caller.uid && caller.uid === parseInt(post.uid, 10);
	if (post.deleted && !(userPrivilege.isAdminOrMod || selfPost)) {
		post.content = '[[topic:post-is-deleted]]';
	}

	return post;
};

postsAPI.getIndex = async (caller, { pid, sort }) => {
	const tid = await posts.getPostField(pid, 'tid');
	const topicPrivileges = await privileges.topics.get(tid, caller.uid);
	if (!topicPrivileges.read || !topicPrivileges['topics:read']) {
		return null;
	}

	return await posts.getPidIndex(pid, tid, sort);
};

postsAPI.getSummary = async (caller, { pid }) => {
	const tid = await posts.getPostField(pid, 'tid');
	const topicPrivileges = await privileges.topics.get(tid, caller.uid);
	if (!topicPrivileges.read || !topicPrivileges['topics:read']) {
		return null;
	}

	const postsData = await posts.getPostSummaryByPids([pid], caller.uid, { stripTags: false });
	posts.modifyPostByPrivilege(postsData[0], topicPrivileges);
	return postsData[0];
};

postsAPI.getRaw = async (caller, { pid }) => {
	const userPrivileges = await privileges.posts.get([pid], caller.uid);
	const userPrivilege = userPrivileges[0];
	if (!userPrivilege['topics:read']) {
		return null;
	}

	const postData = await posts.getPostFields(pid, ['content', 'deleted']);
	const selfPost = caller.uid && caller.uid === parseInt(postData.uid, 10);

	if (postData.deleted && !(userPrivilege.isAdminOrMod || selfPost)) {
		return null;
	}
	postData.pid = pid;
	const result = await plugins.hooks.fire('filter:post.getRawPost', { uid: caller.uid, postData: postData });
	return result.postData.content;
};

postsAPI.edit = async function (caller, data) {
	if (!data || !data.pid || (meta.config.minimumPostLength !== 0 && !data.content)) {
		throw new Error('[[error:invalid-data]]');
	}
	if (!caller.uid) {
		throw new Error('[[error:not-logged-in]]');
	}

	// Discard content for non-local posts
	if (!utils.isNumber(data.pid)) {
		data.content = null;
	} else {
		// Trim and remove HTML (latter for composers that send in HTML, like redactor)
		const contentLen = utils.stripHTMLTags(data.content).trim().length;

		if (meta.config.minimumPostLength !== 0 && contentLen < meta.config.minimumPostLength) {
			throw new Error(`[[error:content-too-short, ${meta.config.minimumPostLength}]]`);
		} else if (contentLen > meta.config.maximumPostLength) {
			throw new Error(`[[error:content-too-long, ${meta.config.maximumPostLength}]]`);
		}
	}

	if (data.title && data.title.length < meta.config.minimumTitleLength) {
		throw new Error(`[[error:title-too-short, ${meta.config.minimumTitleLength}]]`);
	} else if (data.title && data.title.length > meta.config.maximumTitleLength) {
		throw new Error(`[[error:title-too-long, ${meta.config.maximumTitleLength}]]`);
	} else if (!await posts.canUserPostContentWithLinks(caller.uid, data.content)) {
		throw new Error(`[[error:not-enough-reputation-to-post-links, ${meta.config['min:rep:post-links']}]]`);
	}

	data.uid = caller.uid;
	data.req = apiHelpers.buildReqObject(caller);
	data.timestamp = parseInt(data.timestamp, 10) || Date.now();

	const editResult = await posts.edit(data);

	const selfPost = parseInt(caller.uid, 10) === parseInt(editResult.post.uid, 10);
	if (!selfPost && editResult.post.changed) {
		await events.log({
			type: `post-edit`,
			uid: caller.uid,
			ip: caller.ip,
			pid: editResult.post.pid,
			oldContent: editResult.post.oldContent,
			newContent: editResult.post.newContent,
		});
	}

	if (editResult.topic.renamed) {
		await events.log({
			type: 'topic-rename',
			uid: caller.uid,
			ip: caller.ip,
			tid: editResult.topic.tid,
			oldTitle: validator.escape(String(editResult.topic.oldTitle)),
			newTitle: validator.escape(String(editResult.topic.title)),
		});
	}
	const postObj = await posts.getPostSummaryByPids([editResult.post.pid], caller.uid, { parse: false, extraFields: ['edited'] });
	postObj.content = editResult.post.content; // re-use already parsed html
	const returnData = { ...postObj[0], ...editResult.post };
	returnData.topic = { ...postObj[0].topic, ...editResult.post.topic };

	if (!editResult.post.deleted) {
		websockets.in(`topic_${editResult.topic.tid}`).emit('event:post_edited', editResult);
		setTimeout(() => {
			activitypub.out.update.note(caller.uid, postObj[0]);
		}, 5000);

		return returnData;
	}

	const memberData = await groups.getMembersOfGroups([
		'administrators',
		'Global Moderators',
		`cid:${editResult.topic.cid}:privileges:moderate`,
		`cid:${editResult.topic.cid}:privileges:groups:moderate`,
	]);

	const uids = _.uniq(_.flatten(memberData).concat(String(caller.uid)));
	uids.forEach(uid => websockets.in(`uid_${uid}`).emit('event:post_edited', editResult));

	return returnData;
};

postsAPI.delete = async function (caller, data) {
	await deleteOrRestore(caller, data, {
		command: 'delete',
		event: 'event:post_deleted',
		type: 'post-delete',
	});
};

postsAPI.restore = async function (caller, data) {
	await deleteOrRestore(caller, data, {
		command: 'restore',
		event: 'event:post_restored',
		type: 'post-restore',
	});
};

async function deleteOrRestore(caller, data, params) {
	if (!data || !data.pid) {
		throw new Error('[[error:invalid-data]]');
	}
	const [postData, { isMain, isLast }] = await Promise.all([
		posts.tools[params.command](caller.uid, data.pid),
		isMainAndLastPost(data.pid),
		activitypub.out.delete.note(caller.uid, data.pid),
	]);
	if (isMain && isLast) {
		await deleteOrRestoreTopicOf(params.command, data.pid, caller);
	}

	websockets.in(`topic_${postData.tid}`).emit(params.event, postData);

	await events.log({
		type: params.type,
		uid: caller.uid,
		pid: data.pid,
		tid: postData.tid,
		ip: caller.ip,
	});
}

async function deleteOrRestoreTopicOf(command, pid, caller) {
	const topic = await posts.getTopicFields(pid, ['tid', 'cid', 'deleted', 'scheduled']);
	// exempt scheduled topics from being deleted/restored
	if (topic.scheduled) {
		return;
	}
	// command: delete/restore
	await apiHelpers.doTopicAction(
		command,
		topic.deleted ? 'event:topic_restored' : 'event:topic_deleted',
		caller,
		{ tids: [topic.tid], cid: topic.cid }
	);
}

postsAPI.purge = async function (caller, data) {
	if (!data || !data.pid) {
		throw new Error('[[error:invalid-data]]');
	}

	const [exists, { isMain, isLast }] = await Promise.all([
		posts.exists(data.pid),
		isMainAndLastPost(data.pid),
	]);
	if (!exists) {
		throw new Error('[[error:no-post]]');
	}
	if (isMain && !isLast) {
		throw new Error('[[error:cant-purge-main-post]]');
	}

	const isMainAndLast = isMain && isLast;
	const postData = await posts.getPostFields(data.pid, ['toPid', 'tid']);
	postData.pid = data.pid;

	const canPurge = await privileges.posts.canPurge(data.pid, caller.uid);
	if (!canPurge) {
		throw new Error('[[error:no-privileges]]');
	}
	posts.clearCachedPost(data.pid);
	await Promise.all([
		posts.purge(data.pid, caller.uid),
		activitypub.out.delete.note(caller.uid, data.pid),
	]);

	websockets.in(`topic_${postData.tid}`).emit('event:post_purged', postData);
	const topicData = await topics.getTopicFields(postData.tid, ['title', 'cid']);

	await events.log({
		type: 'post-purge',
		pid: data.pid,
		uid: caller.uid,
		ip: caller.ip,
		tid: postData.tid,
		title: String(topicData.title),
	});

	if (isMainAndLast) {
		await apiHelpers.doTopicAction(
			'purge',
			'event:topic_purged',
			caller,
			{ tids: [postData.tid], cid: topicData.cid }
		);
	}
};

async function isMainAndLastPost(pid) {
	const [isMain, topicData] = await Promise.all([
		posts.isMain(pid),
		posts.getTopicFields(pid, ['postcount']),
	]);
	return {
		isMain: isMain,
		isLast: topicData && topicData.postcount === 1,
	};
}

postsAPI.move = async function (caller, data) {
	if (!caller.uid) {
		throw new Error('[[error:not-logged-in]]');
	}
	if (!data || !data.pid || !data.tid) {
		throw new Error('[[error:invalid-data]]');
	}
	const canMove = await Promise.all([
		privileges.topics.isAdminOrMod(data.tid, caller.uid),
		privileges.posts.canMove(data.pid, caller.uid),
	]);
	if (!canMove.every(Boolean)) {
		throw new Error('[[error:no-privileges]]');
	}

	await topics.movePostToTopic(caller.uid, data.pid, data.tid);

	const [postDeleted, topicDeleted] = await Promise.all([
		posts.getPostField(data.pid, 'deleted'),
		topics.getTopicField(data.tid, 'deleted'),
		await events.log({
			type: `post-move`,
			uid: caller.uid,
			ip: caller.ip,
			pid: data.pid,
			toTid: data.tid,
		}),
	]);

	if (!postDeleted && !topicDeleted) {
		socketHelpers.sendNotificationToPostOwner(data.pid, caller.uid, 'move', 'notifications:moved-your-post');

		// ideally we should federate a "move" activity instead, then can capture remote posts too. tbd
		if (utils.isNumber(data.pid)) {
			const { activity } = await activitypub.mocks.activities.create(data.pid, caller.uid);
			await activitypub.feps.announce(data.pid, activity);
		}
	}
};

postsAPI.upvote = async function (caller, data) {
	return await apiHelpers.postCommand(caller, 'upvote', 'voted', 'notifications:upvoted-your-post-in', data);
};

postsAPI.downvote = async function (caller, data) {
	return await apiHelpers.postCommand(caller, 'downvote', 'voted', '', data);
};

postsAPI.unvote = async function (caller, data) {
	return await apiHelpers.postCommand(caller, 'unvote', 'voted', '', data);
};

postsAPI.getVoters = async function (caller, data) {
	if (!data || !data.pid) {
		throw new Error('[[error:invalid-data]]');
	}
	const { pid } = data;
	const cid = await posts.getCidByPid(pid);
	const [canSeeUpvotes, canSeeDownvotes] = await Promise.all([
		canSeeVotes(caller.uid, cid, 'upvoteVisibility'),
		canSeeVotes(caller.uid, cid, 'downvoteVisibility'),
	]);

	if (!canSeeUpvotes && !canSeeDownvotes) {
		throw new Error('[[error:no-privileges]]');
	}
	const repSystemDisabled = meta.config['reputation:disabled'];
	const showUpvotes = canSeeUpvotes && !repSystemDisabled;
	const showDownvotes = canSeeDownvotes && !meta.config['downvote:disabled'] && !repSystemDisabled;
	const [upvoteUids, downvoteUids] = await Promise.all([
		showUpvotes ? db.getSetMembers(`pid:${data.pid}:upvote`) : [],
		showDownvotes ? db.getSetMembers(`pid:${data.pid}:downvote`) : [],
	]);

	const [upvoters, downvoters] = await Promise.all([
		user.getUsersFields(upvoteUids, ['username', 'userslug', 'picture']),
		user.getUsersFields(downvoteUids, ['username', 'userslug', 'picture']),
	]);

	return {
		upvoteCount: upvoters.length,
		downvoteCount: downvoters.length,
		showUpvotes: showUpvotes,
		showDownvotes: showDownvotes,
		upvoters: upvoters,
		downvoters: downvoters,
	};
};

postsAPI.getUpvoters = async function (caller, data) {
	if (!data.pid) {
		throw new Error('[[error:invalid-data]]');
	}
	const { pid } = data;
	const cid = await posts.getCidByPid(pid);
	if (!await canSeeVotes(caller.uid, cid, 'upvoteVisibility')) {
		throw new Error('[[error:no-privileges]]');
	}

	const upvotedUids = (await posts.getUpvotedUidsByPids([pid]))[0];
	return await getTooltipData(upvotedUids);
};

async function getTooltipData(uids) {
	const cutoff = 6;
	if (!uids.length) {
		return {
			otherCount: 0,
			usernames: [],
			cutoff,
		};
	}
	let otherCount = 0;
	if (uids.length > cutoff) {
		otherCount = uids.length - (cutoff - 1);
		uids = uids.slice(0, cutoff - 1);
	}

	const users = await user.getUsersFields(uids, ['username']);
	return {
		otherCount,
		usernames: users.map(user => user.displayname),
		cutoff,
	};
}

postsAPI.getAnnouncers = async (caller, data) => {
	if (!data.pid) {
		throw new Error('[[error:invalid-data]]');
	}
	if (!meta.config.activitypubEnabled) {
		return [];
	}
	const { pid } = data;
	const cid = await posts.getCidByPid(pid);
	if (!await privileges.categories.isUserAllowedTo('topics:read', cid, caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}
	const notes = require('../activitypub/notes');
	const announcers = await notes.announce.list({ pid });
	const uids = announcers.map(ann => ann.actor);
	if (data.tooltip) {
		return await getTooltipData(uids);
	}
	return {
		announceCount: uids.length,
		announcers: await user.getUsersFields(uids, ['username', 'userslug', 'picture']),
	};
};

async function canSeeVotes(uid, cids, type) {
	const isArray = Array.isArray(cids);
	if (!isArray) {
		cids = [cids];
	}
	const uniqCids = _.uniq(cids);
	const [canRead, isAdmin, isMod] = await Promise.all([
		privileges.categories.isUserAllowedTo(
			'topics:read', uniqCids, uid
		),
		privileges.users.isAdministrator(uid),
		privileges.users.isModerator(uid, cids),
	]);
	const cidToAllowed = _.zipObject(uniqCids, canRead);
	const checks = cids.map(
		(cid, index) => isAdmin || isMod[index] ||
		(
			cidToAllowed[cid] &&
			(
				meta.config[type] === 'all' ||
				(meta.config[type] === 'loggedin' && parseInt(uid, 10) > 0)
			)
		)
	);
	return isArray ? checks : checks[0];
}

postsAPI.bookmark = async function (caller, data) {
	return await apiHelpers.postCommand(caller, 'bookmark', 'bookmarked', '', data);
};

postsAPI.unbookmark = async function (caller, data) {
	return await apiHelpers.postCommand(caller, 'unbookmark', 'bookmarked', '', data);
};

async function diffsPrivilegeCheck(pid, uid) {
	const [deleted, privilegesData] = await Promise.all([
		posts.getPostField(pid, 'deleted'),
		privileges.posts.get([pid], uid),
	]);

	const allowed = privilegesData[0]['posts:history'] && (deleted ? privilegesData[0]['posts:view_deleted'] : true);
	if (!allowed) {
		throw new Error('[[error:no-privileges]]');
	}
}

postsAPI.getDiffs = async (caller, data) => {
	await diffsPrivilegeCheck(data.pid, caller.uid);
	const [timestamps, post, diffs] = await Promise.all([
		posts.diffs.list(data.pid),
		posts.getPostFields(data.pid, ['timestamp', 'uid']),
		posts.diffs.get(data.pid),
	]);

	const uids = diffs.map(diff => diff.uid || null);
	uids.push(post.uid);
	let usernames = await user.getUsersFields(uids, ['username']);
	usernames = usernames.map(userObj => (userObj.uid ? userObj.username : null));

	const cid = await posts.getCidByPid(data.pid);
	const [isAdmin, isModerator] = await Promise.all([
		user.isAdministrator(caller.uid),
		privileges.users.isModerator(caller.uid, cid),
	]);

	// timestamps returned by posts.diffs.list are strings
	timestamps.push(String(post.timestamp));
	const result = await plugins.hooks.fire('filter:post.getDiffs', {
		uid: caller.uid,
		pid: data.pid,
		timestamps: timestamps,
		revisions: timestamps.map((timestamp, idx) => ({
			timestamp: timestamp,
			username: usernames[idx],
			uid: uids[idx],
		})),
		// Only admins, global mods and moderator of that cid can delete a diff
		deletable: isAdmin || isModerator,
		// These and post owners can restore to a different post version
		editable: isAdmin || isModerator || parseInt(caller.uid, 10) === parseInt(post.uid, 10),
	});
	return result;
};

postsAPI.loadDiff = async (caller, data) => {
	await diffsPrivilegeCheck(data.pid, caller.uid);
	return await posts.diffs.load(data.pid, data.since, caller.uid);
};

postsAPI.restoreDiff = async (caller, data) => {
	const cid = await posts.getCidByPid(data.pid);
	const canEdit = await privileges.categories.can('posts:edit', cid, caller.uid);
	if (!canEdit) {
		throw new Error('[[error:no-privileges]]');
	}

	const edit = await posts.diffs.restore(data.pid, data.since, caller.uid, apiHelpers.buildReqObject(caller));
	websockets.in(`topic_${edit.topic.tid}`).emit('event:post_edited', edit);
};

postsAPI.deleteDiff = async (caller, { pid, timestamp }) => {
	const cid = await posts.getCidByPid(pid);
	const [isAdmin, isModerator] = await Promise.all([
		privileges.users.isAdministrator(caller.uid),
		privileges.users.isModerator(caller.uid, cid),
	]);

	if (!(isAdmin || isModerator)) {
		throw new Error('[[error:no-privileges]]');
	}

	await posts.diffs.delete(pid, timestamp, caller.uid);
};

postsAPI.getReplies = async (caller, { pid }) => {
	if (!utils.isNumber(pid) && !activitypub.helpers.isUri(pid)) {
		throw new Error('[[error:invalid-data]]');
	}
	const { uid } = caller;
	const canRead = await privileges.posts.can('topics:read', pid, caller.uid);
	if (!canRead) {
		return null;
	}

	const { topicPostSort } = await user.getSettings(uid);
	const pids = await posts.getPidsFromSet(`pid:${pid}:replies`, 0, -1, topicPostSort === 'newest_to_oldest');

	let [postData, postPrivileges] = await Promise.all([
		posts.getPostsByPids(pids, uid),
		privileges.posts.get(pids, uid),
	]);
	postData = await topics.addPostData(postData, uid);
	postData.forEach((postData, index) => posts.modifyPostByPrivilege(postData, postPrivileges[index]));
	postData = postData.filter((postData, index) => postData && postPrivileges[index].read);
	postData = await user.blocks.filter(uid, postData);

	return postData;
};

postsAPI.acceptQueuedPost = async (caller, data) => {
	await canEditQueue(caller.uid, data, 'accept');
	const result = await posts.submitFromQueue(data.id);
	if (result && caller.uid !== parseInt(result.uid, 10)) {
		await sendQueueNotification('post-queue-accepted', result.uid, `/post/${result.pid}`);
	}
	await logQueueEvent(caller, result, 'accept');
	return { type: result.type, pid: result.pid, tid: result.tid };
};

postsAPI.removeQueuedPost = async (caller, data) => {
	await canEditQueue(caller.uid, data, 'reject');
	const result = await posts.removeFromQueue(data.id);
	if (result && caller.uid !== parseInt(result.uid, 10)) {
		await sendQueueNotification('post-queue-rejected', result.uid, '/');
	}
	await logQueueEvent(caller, result, 'reject');
};

postsAPI.editQueuedPost = async (caller, data) => {
	if (!data || !data.id || (!data.content && !data.title && !data.cid)) {
		throw new Error('[[error:invalid-data]]');
	}
	await posts.editQueuedContent(caller.uid, data);
	if (data.content) {
		return await plugins.hooks.fire('filter:parse.post', { postData: data });
	}
	return { postData: data };
};

postsAPI.notifyQueuedPostOwner = async (caller, data) => {
	await canEditQueue(caller.uid, data, 'notify');
	const result = await posts.getFromQueue(data.id);
	if (result) {
		await sendQueueNotification('post-queue-notify', result.uid, `/post-queue/${data.id}`, validator.escape(String(data.message)));
	}
};

async function canEditQueue(uid, data, action) {
	const [canEditQueue, queuedPost] = await Promise.all([
		posts.canEditQueue(uid, data, action),
		posts.getFromQueue(data.id),
	]);
	if (!queuedPost) {
		throw new Error('[[error:no-post]]');
	}
	if (!canEditQueue) {
		throw new Error('[[error:no-privileges]]');
	}
}

async function logQueueEvent(caller, result, type) {
	const eventData = {
		type: `post-queue-${result.type}-${type}`,
		uid: caller.uid,
		ip: caller.ip,
		content: result.data.content,
		targetUid: result.uid,
	};
	if (result.type === 'topic') {
		eventData.cid = result.data.cid;
		eventData.title = result.data.title;
	} else {
		eventData.tid = result.data.tid;
	}
	if (result.pid) {
		eventData.pid = result.pid;
	}
	await events.log(eventData);
}

async function sendQueueNotification(type, targetUid, path, notificationText) {
	const bodyShort = notificationText ?
		translator.compile(`notifications:${type}`, notificationText) :
		translator.compile(`notifications:${type}`);
	const notifData = {
		type: type,
		nid: `${type}-${targetUid}-${path}`,
		bodyShort: bodyShort,
		path: path,
	};
	if (parseInt(meta.config.postQueueNotificationUid, 10) > 0) {
		notifData.from = meta.config.postQueueNotificationUid;
	}
	const notifObj = await notifications.create(notifData);
	await notifications.push(notifObj, [targetUid]);
}

postsAPI.changeOwner = async function (caller, data) {
	if (!data || !Array.isArray(data.pids) || !data.uid) {
		throw new Error('[[error:invalid-data]]');
	}
	const isAdminOrGlobalMod = await user.isAdminOrGlobalMod(caller.uid);
	if (!isAdminOrGlobalMod) {
		throw new Error('[[error:no-privileges]]');
	}

	const postData = await posts.changeOwner(data.pids, data.uid);
	const logs = postData.map(({ pid, uid, cid }) => (events.log({
		type: 'post-change-owner',
		uid: caller.uid,
		ip: caller.ip,
		targetUid: data.uid,
		pid: pid,
		originalUid: uid,
		cid: cid,
	})));

	await Promise.all(logs);
};