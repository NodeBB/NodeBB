'use strict';

const db = require('../database');
const posts = require('../posts');
const privileges = require('../privileges');
const plugins = require('../plugins');
const meta = require('../meta');
const topics = require('../topics');
const categories = require('../categories');
const user = require('../user');
const socketHelpers = require('./helpers');
const utils = require('../utils');

const apiController = require('../controllers/api');

const SocketPosts = module.exports;

require('./posts/edit')(SocketPosts);
require('./posts/move')(SocketPosts);
require('./posts/votes')(SocketPosts);
require('./posts/bookmarks')(SocketPosts);
require('./posts/tools')(SocketPosts);
require('./posts/diffs')(SocketPosts);

SocketPosts.reply = async function (socket, data) {
	if (!data || !data.tid || (meta.config.minimumPostLength !== 0 && !data.content)) {
		throw new Error('[[error:invalid-data]]');
	}

	socketHelpers.setDefaultPostData(data, socket);
	await meta.blacklist.test(data.req.ip);
	const shouldQueue = await posts.shouldQueue(socket.uid, data);
	if (shouldQueue) {
		return await posts.addToQueue(data);
	}
	return await postReply(socket, data);
};

async function postReply(socket, data) {
	const postData = await topics.reply(data);
	const result = {
		posts: [postData],
		'reputation:disabled': meta.config['reputation:disabled'] === 1,
		'downvote:disabled': meta.config['downvote:disabled'] === 1,
	};

	socket.emit('event:new_post', result);

	user.updateOnlineUsers(socket.uid);

	socketHelpers.notifyNew(socket.uid, 'newPost', result);

	return postData;
}

SocketPosts.getRawPost = async function (socket, pid) {
	const canRead = await privileges.posts.can('topics:read', pid, socket.uid);
	if (!canRead) {
		throw new Error('[[error:no-privileges]]');
	}

	const postData = await posts.getPostFields(pid, ['content', 'deleted']);
	if (postData.deleted) {
		throw new Error('[[error:no-post]]');
	}
	postData.pid = pid;
	const result = await plugins.fireHook('filter:post.getRawPost', { uid: socket.uid, postData: postData });
	return result.postData.content;
};

SocketPosts.getTimestampByIndex = async function (socket, data) {
	if (data.index < 0) {
		data.index = 0;
	}
	let pid;
	if (data.index === 0) {
		pid = await topics.getTopicField(data.tid, 'mainPid');
	} else {
		pid = await db.getSortedSetRange('tid:' + data.tid + ':posts', data.index - 1, data.index - 1);
	}
	pid = Array.isArray(pid) ? pid[0] : pid;
	if (!pid) {
		return 0;
	}

	const canRead = await privileges.posts.can('topics:read', pid, socket.uid);
	if (!canRead) {
		throw new Error('[[error:no-privileges]]');
	}
	return await posts.getPostField(pid, 'timestamp');
};

SocketPosts.getPost = async function (socket, pid) {
	return await apiController.getPostData(pid, socket.uid);
};

SocketPosts.loadMoreBookmarks = async function (socket, data) {
	return await loadMorePosts('uid:' + data.uid + ':bookmarks', socket.uid, data);
};

SocketPosts.loadMoreUserPosts = async function (socket, data) {
	const cids = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
	const keys = cids.map(c => 'cid:' + c + ':uid:' + data.uid + ':pids');
	return await loadMorePosts(keys, socket.uid, data);
};

SocketPosts.loadMoreBestPosts = async function (socket, data) {
	const cids = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'topics:read');
	const keys = cids.map(c => 'cid:' + c + ':uid:' + data.uid + ':pids:votes');
	return await loadMorePosts(keys, socket.uid, data);
};

SocketPosts.loadMoreUpVotedPosts = async function (socket, data) {
	return await loadMorePosts('uid:' + data.uid + ':upvote', socket.uid, data);
};

SocketPosts.loadMoreDownVotedPosts = async function (socket, data) {
	return await loadMorePosts('uid:' + data.uid + ':downvote', socket.uid, data);
};

async function loadMorePosts(set, uid, data) {
	if (!data || !utils.isNumber(data.uid) || !utils.isNumber(data.after)) {
		throw new Error('[[error:invalid-data]]');
	}

	const start = Math.max(0, parseInt(data.after, 10));
	const stop = start + 9;

	return await posts.getPostSummariesFromSet(set, uid, start, stop);
}

SocketPosts.getCategory = async function (socket, pid) {
	return await posts.getCidByPid(pid);
};

SocketPosts.getPidIndex = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	return await posts.getPidIndex(data.pid, data.tid, data.topicPostSort);
};

SocketPosts.getReplies = async function (socket, pid) {
	if (!utils.isNumber(pid)) {
		throw new Error('[[error:invalid-data]]');
	}

	const pids = await posts.getPidsFromSet('pid:' + pid + ':replies', 0, -1, false);

	var [postData, postPrivileges] = await Promise.all([
		posts.getPostsByPids(pids, socket.uid),
		privileges.posts.get(pids, socket.uid),
	]);
	postData = await topics.addPostData(postData, socket.uid);
	postData.forEach((postData, index) => posts.modifyPostByPrivilege(postData, postPrivileges[index]));
	postData = postData.filter((postData, index) => postData && postPrivileges[index].read);
	return postData;
};

SocketPosts.accept = async function (socket, data) {
	await acceptOrReject(posts.submitFromQueue, socket, data);
};

SocketPosts.reject = async function (socket, data) {
	await acceptOrReject(posts.removeFromQueue, socket, data);
};

async function acceptOrReject(method, socket, data) {
	const canEditQueue = await posts.canEditQueue(socket.uid, data.id);
	if (!canEditQueue) {
		throw new Error('[[error:no-privileges]]');
	}
	await method(data.id);
}

SocketPosts.editQueuedContent = async function (socket, data) {
	if (!data || !data.id || !data.content) {
		throw new Error('[[error:invalid-data]]');
	}
	await posts.editQueuedContent(socket.uid, data.id, data.content);
	return await plugins.fireHook('filter:parse.post', { postData: data });
};

require('../promisify')(SocketPosts);
