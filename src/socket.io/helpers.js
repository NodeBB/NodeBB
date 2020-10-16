'use strict';

const _ = require('lodash');

const db = require('../database');
const websockets = require('./index');
const user = require('../user');
const posts = require('../posts');
const topics = require('../topics');
const categories = require('../categories');
const privileges = require('../privileges');
const notifications = require('../notifications');
const plugins = require('../plugins');
const utils = require('../utils');
const batch = require('../batch');

const SocketHelpers = module.exports;

SocketHelpers.setDefaultPostData = function (data, socket) {
	data.uid = socket.uid;
	data.req = websockets.reqFromSocket(socket);
	data.timestamp = Date.now();
	data.fromQueue = false;
};

SocketHelpers.notifyNew = async function (uid, type, result) {
	let uids = await user.getUidsFromSet('users:online', 0, -1);
	uids = uids.filter(toUid => parseInt(toUid, 10) !== uid);
	await batch.processArray(uids, async function (uids) {
		await notifyUids(uid, uids, type, result);
	}, {
		interval: 1000,
	});
};

async function notifyUids(uid, uids, type, result) {
	const post = result.posts[0];
	const tid = post.topic.tid;
	const cid = post.topic.cid;
	uids = await privileges.topics.filterUids('topics:read', tid, uids);
	const watchStateUids = uids;

	const watchStates = await getWatchStates(watchStateUids, tid, cid);

	const categoryWatchStates = _.zipObject(watchStateUids, watchStates.categoryWatchStates);
	const topicFollowState = _.zipObject(watchStateUids, watchStates.topicFollowed);
	uids = filterTidCidIgnorers(watchStateUids, watchStates);
	uids = await user.blocks.filterUids(uid, uids);
	uids = await user.blocks.filterUids(post.topic.uid, uids);
	const data = await plugins.fireHook('filter:sockets.sendNewPostToUids', { uidsTo: uids, uidFrom: uid, type: type });

	post.ip = undefined;

	data.uidsTo.forEach(function (toUid) {
		post.categoryWatchState = categoryWatchStates[toUid];
		post.topic.isFollowing = topicFollowState[toUid];
		websockets.in('uid_' + toUid).emit('event:new_post', result);
		if (result.topic && type === 'newTopic') {
			websockets.in('uid_' + toUid).emit('event:new_topic', result.topic);
		}
	});
}

async function getWatchStates(uids, tid, cid) {
	return await utils.promiseParallel({
		topicFollowed: db.isSetMembers('tid:' + tid + ':followers', uids),
		topicIgnored: db.isSetMembers('tid:' + tid + ':ignorers', uids),
		categoryWatchStates: categories.getUidsWatchStates(cid, uids),
	});
}

function filterTidCidIgnorers(uids, watchStates) {
	return uids.filter(function (uid, index) {
		return watchStates.topicFollowed[index] ||
			(!watchStates.topicIgnored[index] && watchStates.categoryWatchStates[index] !== categories.watchStates.ignoring);
	});
}

SocketHelpers.sendNotificationToPostOwner = async function (pid, fromuid, command, notification) {
	if (!pid || !fromuid || !notification) {
		return;
	}
	fromuid = parseInt(fromuid, 10);
	const postData = await posts.getPostFields(pid, ['tid', 'uid', 'content']);
	const [canRead, isIgnoring] = await Promise.all([
		privileges.posts.can('topics:read', pid, postData.uid),
		topics.isIgnoring([postData.tid], postData.uid),
	]);
	if (!canRead || isIgnoring[0] || !postData.uid || fromuid === postData.uid) {
		return;
	}
	const [username, topicTitle, postObj] = await Promise.all([
		user.getUserField(fromuid, 'username'),
		topics.getTopicField(postData.tid, 'title'),
		posts.parsePost(postData),
	]);

	const title = utils.decodeHTMLEntities(topicTitle);
	const titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

	const notifObj = await notifications.create({
		type: command,
		bodyShort: '[[' + notification + ', ' + username + ', ' + titleEscaped + ']]',
		bodyLong: postObj.content,
		pid: pid,
		tid: postData.tid,
		path: '/post/' + pid,
		nid: command + ':post:' + pid + ':uid:' + fromuid,
		from: fromuid,
		mergeId: notification + '|' + pid,
		topicTitle: topicTitle,
	});

	notifications.push(notifObj, [postData.uid]);
};


SocketHelpers.sendNotificationToTopicOwner = async function (tid, fromuid, command, notification) {
	if (!tid || !fromuid || !notification) {
		return;
	}

	fromuid = parseInt(fromuid, 10);

	const [username, topicData] = await Promise.all([
		user.getUserField(fromuid, 'username'),
		topics.getTopicFields(tid, ['uid', 'slug', 'title']),
	]);

	if (fromuid === topicData.uid) {
		return;
	}
	const ownerUid = topicData.uid;
	const title = utils.decodeHTMLEntities(topicData.title);
	const titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

	const notifObj = await notifications.create({
		bodyShort: '[[' + notification + ', ' + username + ', ' + titleEscaped + ']]',
		path: '/topic/' + topicData.slug,
		nid: command + ':tid:' + tid + ':uid:' + fromuid,
		from: fromuid,
	});

	if (ownerUid) {
		notifications.push(notifObj, [ownerUid]);
	}
};

SocketHelpers.upvote = async function (data, notification) {
	if (!data || !data.post || !data.post.uid || !data.post.votes || !data.post.pid || !data.fromuid) {
		return;
	}

	const votes = data.post.votes;
	const touid = data.post.uid;
	const fromuid = data.fromuid;
	const pid = data.post.pid;

	const shouldNotify = {
		all: function () {
			return votes > 0;
		},
		first: function () {
			return votes === 1;
		},
		everyTen: function () {
			return votes > 0 && votes % 10 === 0;
		},
		threshold: function () {
			return [1, 5, 10, 25].includes(votes) || (votes >= 50 && votes % 50 === 0);
		},
		logarithmic: function () {
			return votes > 1 && Math.log10(votes) % 1 === 0;
		},
		disabled: function () {
			return false;
		},
	};
	const settings = await user.getSettings(touid);
	const should = shouldNotify[settings.upvoteNotifFreq] || shouldNotify.all;

	if (should()) {
		SocketHelpers.sendNotificationToPostOwner(pid, fromuid, 'upvote', notification);
	}
};

SocketHelpers.rescindUpvoteNotification = async function (pid, fromuid) {
	await notifications.rescind('upvote:post:' + pid + ':uid:' + fromuid);
	const uid = await posts.getPostField(pid, 'uid');
	const count = await user.notifications.getUnreadCount(uid);
	websockets.in('uid_' + uid).emit('event:notifications.updateCount', count);
};

SocketHelpers.emitToUids = async function (event, data, uids) {
	uids.forEach(toUid => websockets.in('uid_' + toUid).emit(event, data));
};

require('../promisify')(SocketHelpers);
