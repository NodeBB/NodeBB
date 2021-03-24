'use strict';

const _ = require('lodash');
const winston = require('winston');
const { CronJob } = require('cron');

const db = require('../database');
const posts = require('../posts');
const socketHelpers = require('../socket.io/helpers');
const topics = require('./index');
const user = require('../user');

const Scheduled = module.exports;

Scheduled.startJobs = function () {
	winston.verbose('[scheduled topics] Starting jobs.');
	new CronJob('*/1 * * * *', Scheduled.handleExpired, null, true);
};

Scheduled.handleExpired = async function () {
	const now = Date.now();
	const tids = await db.getSortedSetRangeByScore('topics:scheduled', 0, -1, '-inf', now);

	if (!tids.length) {
		return;
	}

	let topicsData = await topics.getTopicsData(tids);
	// Filter deleted
	topicsData = topicsData.filter(topicData => Boolean(topicData));
	const uids = _.uniq(topicsData.map(topicData => topicData.uid)).filter(uid => uid); // Filter guests topics

	// Restore first to be not filtered for being deleted
	// Restoring handles "updateRecentTid"
	await Promise.all(topicsData.map(topicData => topics.restore(topicData.tid)));

	await Promise.all([].concat(
		sendNotifications(uids, topicsData),
		updateUserLastposttimes(uids, topicsData),
		...topicsData.map(topicData => unpin(topicData.tid, topicData)),
		db.sortedSetsRemoveRangeByScore([`topics:scheduled`], '-inf', now)
	));
};

// topics/tools.js#pin/unpin would block non-admins/mods, thus the local versions
Scheduled.pin = async function (tid, topicData) {
	return Promise.all([
		topics.setTopicField(tid, 'pinned', 1),
		db.sortedSetAdd(`cid:${topicData.cid}:tids:pinned`, Date.now(), tid),
		db.sortedSetsRemove([
			`cid:${topicData.cid}:tids`,
			`cid:${topicData.cid}:tids:posts`,
			`cid:${topicData.cid}:tids:votes`,
		], tid),
	]);
};

function unpin(tid, topicData) {
	return [
		topics.setTopicField(tid, 'pinned', 0),
		topics.deleteTopicField(tid, 'pinExpiry'),
		db.sortedSetRemove(`cid:${topicData.cid}:tids:pinned`, tid),
		db.sortedSetAddBulk([
			[`cid:${topicData.cid}:tids`, topicData.lastposttime, tid],
			[`cid:${topicData.cid}:tids:posts`, topicData.postcount, tid],
			[`cid:${topicData.cid}:tids:votes`, parseInt(topicData.votes, 10) || 0, tid],
		]),
	];
}

async function sendNotifications(uids, topicsData) {
	const usernames = await Promise.all(uids.map(uid => user.getUserField(uid, 'username')));
	const uidToUsername = Object.fromEntries(uids.map((uid, idx) => [uid, usernames[idx]]));

	const postsData = await posts.getPostsData(topicsData.map(({ mainPid }) => mainPid));
	postsData.forEach((postData, idx) => {
		postData.user = {};
		postData.user.username = uidToUsername[postData.uid];
		postData.topic = topicsData[idx];
	});

	return topicsData.map(
		(t, idx) => user.notifications.sendTopicNotificationToFollowers(t.uid, t, postsData[idx])
	).concat(
		topicsData.map(
			(t, idx) => socketHelpers.notifyNew(t.uid, 'newTopic', { posts: [postsData[idx]], topic: t })
		)
	);
}

async function updateUserLastposttimes(uids, topicsData) {
	const lastposttimes = (await user.getUsersFields(uids, ['lastposttime'])).map(u => u.lastposttime);

	let timestampByUid = {};
	topicsData.forEach((tD) => {
		timestampByUid[tD.uid] = timestampByUid[tD.uid] ? timestampByUid[tD.uid].concat(tD.timestamp) : [tD.timestamp];
	});
	timestampByUid = Object.fromEntries(
		Object.entries(timestampByUid).filter(uidTimestamp => [uidTimestamp[0], Math.max(...uidTimestamp[1])])
	);

	const uidsToUpdate = uids.filter((uid, idx) => timestampByUid[uid] > lastposttimes[idx]);
	return uidsToUpdate.map(uid => user.setUserField(uid, 'lastposttime', String(timestampByUid[uid])));
}
