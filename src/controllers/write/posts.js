'use strict';

const validator = require('validator');
const _ = require('lodash');

const meta = require('../../meta');
const groups = require('../../groups');
const posts = require('../../posts');
const topics = require('../../topics');
const events = require('../../events');
const utils = require('../../utils');

const helpers = require('../helpers');
const sockets = require('../../socket.io');
const socketTopics = require('../../socket.io/topics');	// eehhh...

const Posts = module.exports;

Posts.edit = async (req, res) => {
	if (meta.config.minimumPostLength !== 0 && !req.body.content) {
		throw new Error('[[error:invalid-data]]');
	}

	// Trim and remove HTML (latter for composers that send in HTML, like redactor)
	var contentLen = utils.stripHTMLTags(req.body.content).trim().length;

	if (req.body.title && req.body.title.length < meta.config.minimumTitleLength) {
		throw new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]');
	} else if (req.body.title && req.body.title.length > meta.config.maximumTitleLength) {
		throw new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]');
	} else if (meta.config.minimumPostLength !== 0 && contentLen < meta.config.minimumPostLength) {
		throw new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]');
	} else if (contentLen > meta.config.maximumPostLength) {
		throw new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]');
	}

	// Payload construction
	var payload = {
		req,
		uid: req.user.uid,
		pid: req.params.pid,
		content: req.body.content,
		options: {},
	};
	['handle', 'title'].forEach((prop) => {
		if (req.body.hasOwnProperty(prop)) {
			payload[prop] = req.body[prop];
		}
	});
	['topic_thumb', 'tags'].forEach((prop) => {
		if (req.body.hasOwnProperty(prop)) {
			payload.options[prop] = req.body[prop];
		}
	});

	const editResult = await posts.edit(payload);
	helpers.formatApiResponse(200, res, await posts.getPostSummaryByPids([editResult.pid], req.user.uid, {}));

	if (editResult.topic.renamed) {
		await events.log({
			type: 'topic-rename',
			uid: req.user.uid,
			ip: req.ip,
			tid: editResult.topic.tid,
			oldTitle: validator.escape(String(editResult.topic.oldTitle)),
			newTitle: validator.escape(String(editResult.topic.title)),
		});
	}

	if (!editResult.post.deleted) {
		sockets.in('topic_' + editResult.topic.tid).emit('event:post_edited', editResult);
	}

	const memberData = await groups.getMembersOfGroups([
		'administrators',
		'Global Moderators',
		'cid:' + editResult.topic.cid + ':privileges:moderate',
		'cid:' + editResult.topic.cid + ':privileges:groups:moderate',
	]);

	const uids = _.uniq(_.flatten(memberData).concat(req.user.uid.toString()));
	uids.forEach(uid =>	sockets.in('uid_' + uid).emit('event:post_edited', editResult));
};

Posts.purge = async (req, res) => {
	const results = await isMainAndLastPost(req.params.pid);
	if (results.isMain && !results.isLast) {
		throw new Error('[[error:cant-purge-main-post]]');
	}

	const isMainAndLast = results.isMain && results.isLast;
	const postData = await posts.getPostFields(req.params.pid, ['pid', 'toPid', 'tid']);

	await posts.tools.purge(req.user.uid, req.params.pid);
	helpers.formatApiResponse(200, res);

	sockets.in('topic_' + postData.tid).emit('event:post_purged', postData);
	const topicData = await topics.getTopicFields(postData.tid, ['title', 'cid']);

	await events.log({
		type: 'post-purge',
		uid: req.user.uid,
		pid: req.params.pid,
		ip: req.ip,
		tid: postData.tid,
		title: String(topicData.title),
	});

	if (isMainAndLast) {
		await socketTopics.doTopicAction('purge', 'event:topic_purged', {
			ip: req.ip,
			uid: req.user.uid,
		}, { tids: [postData.tid], cid: topicData.cid });
	}
};

Posts.restore = async (req, res) => {
	await deleteOrRestore(req, {
		pid: req.params.pid,
	}, {
		command: 'restore',
		event: 'event:post_restored',
		type: 'post-restore',
	});

	helpers.formatApiResponse(200, res);
};

Posts.delete = async (req, res) => {
	await deleteOrRestore(req, {
		pid: req.params.pid,
	}, {
		command: 'delete',
		event: 'event:post_deleted',
		type: 'post-delete',
	});

	helpers.formatApiResponse(200, res);
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

async function deleteOrRestoreTopicOf(command, pid, req) {
	const topic = await posts.getTopicFields(pid, ['tid', 'cid', 'deleted']);
	if (command === 'delete' && !topic.deleted) {
		await socketTopics.doTopicAction('delete', 'event:topic_deleted', {
			uid: req.user.uid,
			ip: req.ip,
		}, { tids: [topic.tid], cid: topic.cid });
	} else if (command === 'restore' && topic.deleted) {
		await socketTopics.doTopicAction('restore', 'event:topic_restored', {
			uid: req.user.uid,
			ip: req.ip,
		}, { tids: [topic.tid], cid: topic.cid });
	}
}

async function deleteOrRestore(req, data, params) {
	if (!data || !data.pid) {
		throw new Error('[[error:invalid-data]]');
	}
	const postData = await posts.tools[params.command](req.user.uid, data.pid);
	const results = await isMainAndLastPost(data.pid);
	if (results.isMain && results.isLast) {
		await deleteOrRestoreTopicOf(params.command, data.pid, req);
	}

	sockets.in('topic_' + postData.tid).emit(params.event, postData);

	await events.log({
		type: params.type,
		uid: req.user.uid,
		pid: data.pid,
		tid: postData.tid,
		ip: req.ip,
	});
}
