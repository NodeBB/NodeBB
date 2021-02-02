'use strict';

const validator = require('validator');
const _ = require('lodash');

const utils = require('../utils');
const user = require('../user');
const posts = require('../posts');
const topics = require('../topics');
const groups = require('../groups');
const meta = require('../meta');
const events = require('../events');
const privileges = require('../privileges');
const apiHelpers = require('./helpers');
const websockets = require('../socket.io');
const socketHelpers = require('../socket.io/helpers');

const postsAPI = module.exports;

postsAPI.get = async function (caller, data) {
	const [userPrivileges, post, voted] = await Promise.all([
		privileges.posts.get([data.pid], caller.uid),
		posts.getPostData(data.pid),
		posts.hasVoted(data.pid, caller.uid),
	]);
	if (!post) {
		return null;
	}
	Object.assign(post, voted);

	const userPrivilege = userPrivileges[0];
	if (!userPrivilege.read || !userPrivilege['topics:read']) {
		return null;
	}

	post.ip = userPrivilege.isAdminOrMod ? post.ip : undefined;
	const selfPost = caller.uid && caller.uid === parseInt(post.uid, 10);
	if (post.deleted && !(userPrivilege.isAdminOrMod || selfPost)) {
		post.content = '[[topic:post_is_deleted]]';
	}

	return post;
};

postsAPI.edit = async function (caller, data) {
	if (!data || !data.pid || (meta.config.minimumPostLength !== 0 && !data.content)) {
		throw new Error('[[error:invalid-data]]');
	}
	// Trim and remove HTML (latter for composers that send in HTML, like redactor)
	const contentLen = utils.stripHTMLTags(data.content).trim().length;

	if (data.title && data.title.length < meta.config.minimumTitleLength) {
		throw new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]');
	} else if (data.title && data.title.length > meta.config.maximumTitleLength) {
		throw new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]');
	} else if (meta.config.minimumPostLength !== 0 && contentLen < meta.config.minimumPostLength) {
		throw new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]');
	} else if (contentLen > meta.config.maximumPostLength) {
		throw new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]');
	}

	data.uid = caller.uid;
	data.req = apiHelpers.buildReqObject(caller);

	const editResult = await posts.edit(data);
	if (editResult.topic.isMainPost) {
		await topics.thumbs.migrate(data.uuid, editResult.topic.tid);
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
	const postObj = await posts.getPostSummaryByPids([editResult.post.pid], caller.uid, {});
	const returnData = { ...postObj[0], ...editResult.post };
	returnData.topic = { ...postObj[0].topic, ...editResult.post.topic };

	if (!editResult.post.deleted) {
		websockets.in('topic_' + editResult.topic.tid).emit('event:post_edited', editResult);
		return returnData;
	}

	const memberData = await groups.getMembersOfGroups([
		'administrators',
		'Global Moderators',
		'cid:' + editResult.topic.cid + ':privileges:moderate',
		'cid:' + editResult.topic.cid + ':privileges:groups:moderate',
	]);

	const uids = _.uniq(_.flatten(memberData).concat(String(caller.uid)));
	uids.forEach(uid =>	websockets.in('uid_' + uid).emit('event:post_edited', editResult));
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
	const postData = await posts.tools[params.command](caller.uid, data.pid);
	const results = await isMainAndLastPost(data.pid);
	if (results.isMain && results.isLast) {
		await deleteOrRestoreTopicOf(params.command, data.pid, caller);
	}

	websockets.in('topic_' + postData.tid).emit(params.event, postData);

	await events.log({
		type: params.type,
		uid: caller.uid,
		pid: data.pid,
		tid: postData.tid,
		ip: caller.ip,
	});
}

async function deleteOrRestoreTopicOf(command, pid, caller) {
	const topic = await posts.getTopicFields(pid, ['tid', 'cid', 'deleted']);
	// command: delete/restore
	await apiHelpers.doTopicAction(command,
		topic.deleted ? 'event:topic_restored' : 'event:topic_deleted',
		caller,
		{ tids: [topic.tid], cid: topic.cid }
	);
}

postsAPI.purge = async function (caller, data) {
	if (!data || !parseInt(data.pid, 10)) {
		throw new Error('[[error:invalid-data]]');
	}

	const results = await isMainAndLastPost(data.pid);
	if (results.isMain && !results.isLast) {
		throw new Error('[[error:cant-purge-main-post]]');
	}

	const isMainAndLast = results.isMain && results.isLast;
	const postData = await posts.getPostFields(data.pid, ['toPid', 'tid']);
	postData.pid = data.pid;

	const canPurge = await privileges.posts.canPurge(data.pid, caller.uid);
	if (!canPurge) {
		throw new Error('[[error:no-privileges]]');
	}
	require('../posts/cache').del(data.pid);
	await posts.purge(data.pid, caller.uid);

	websockets.in('topic_' + postData.tid).emit('event:post_purged', postData);
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
		await apiHelpers.doTopicAction('purge', 'event:topic_purged',
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
	]);

	if (!postDeleted && !topicDeleted) {
		socketHelpers.sendNotificationToPostOwner(data.pid, caller.uid, 'move', 'notifications:moved_your_post');
	}
};

postsAPI.upvote = async function (caller, data) {
	return await apiHelpers.postCommand(caller, 'upvote', 'voted', 'notifications:upvoted_your_post_in', data);
};

postsAPI.downvote = async function (caller, data) {
	return await apiHelpers.postCommand(caller, 'downvote', 'voted', '', data);
};

postsAPI.unvote = async function (caller, data) {
	return await apiHelpers.postCommand(caller, 'unvote', 'voted', '', data);
};

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
	const timestamps = await posts.diffs.list(data.pid);
	const post = await posts.getPostFields(data.pid, ['timestamp', 'uid']);

	const diffs = await posts.diffs.get(data.pid);
	const uids = diffs.map(diff => diff.uid || null);
	uids.push(post.uid);
	let usernames = await user.getUsersFields(uids, ['username']);
	usernames = usernames.map(userObj => (userObj.uid ? userObj.username : null));

	const cid = await posts.getCidByPid(data.pid);
	const [isAdmin, isModerator] = await Promise.all([
		user.isAdministrator(caller.uid),
		privileges.users.isModerator(caller.uid, cid),
	]);

	timestamps.push(post.timestamp);

	return {
		timestamps: timestamps,
		revisions: timestamps.map((timestamp, idx) => ({
			timestamp: timestamp,
			username: usernames[idx],
		})),
		// Only admins, global mods and moderator of that cid can delete a diff
		deletable: isAdmin || isModerator,
		// These and post owners can restore to a different post version
		editable: isAdmin || isModerator || parseInt(caller.uid, 10) === parseInt(post.uid, 10),
	};
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
	websockets.in('topic_' + edit.topic.tid).emit('event:post_edited', edit);
};
