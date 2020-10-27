'use strict';

const validator = require('validator');
const _ = require('lodash');

const utils = require('../utils');
const posts = require('../posts');
const topics = require('../topics');
const groups = require('../groups');
const meta = require('../meta');
const events = require('../events');
const privileges = require('../privileges');
const apiHelpers = require('./helpers');
const websockets = require('../socket.io');

const postsAPI = module.exports;

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
