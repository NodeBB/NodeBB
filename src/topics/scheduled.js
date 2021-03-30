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
	await Promise.all([].concat(
		topicsData.map(topicData => topics.restore(topicData.tid)),
		topicsData.map(topicData => topics.updateLastPostTimeFromLastPid(topicData.tid))
	));

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

Scheduled.reschedule = async function ({ cid, tid, timestamp, uid }) {
	await Promise.all([
		db.sortedSetsAdd([
			'topics:scheduled',
			`uid:${uid}:topics`,
			'topics:tid',
			`cid:${cid}:tids`,
			`cid:${cid}:uid:${uid}:tids`,
		], timestamp, tid),
		shiftPostTimes(tid, timestamp),
	]);
	return topics.updateLastPostTimeFromLastPid(tid);
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

	return Promise.all(topicsData.map(
		(t, idx) => user.notifications.sendTopicNotificationToFollowers(t.uid, t, postsData[idx])
	).concat(
		topicsData.map(
			(t, idx) => socketHelpers.notifyNew(t.uid, 'newTopic', { posts: [postsData[idx]], topic: t })
		)
	));
}

async function updateUserLastposttimes(uids, topicsData) {
	const lastposttimes = (await user.getUsersFields(uids, ['lastposttime'])).map(u => u.lastposttime);

	let tstampByUid = {};
	topicsData.forEach((tD) => {
		tstampByUid[tD.uid] = tstampByUid[tD.uid] ? tstampByUid[tD.uid].concat(tD.lastposttime) : [tD.lastposttime];
	});
	tstampByUid = Object.fromEntries(
		Object.entries(tstampByUid).map(uidTimestamp => [uidTimestamp[0], Math.max(...uidTimestamp[1])])
	);

	const uidsToUpdate = uids.filter((uid, idx) => tstampByUid[uid] > lastposttimes[idx]);
	return Promise.all(uidsToUpdate.map(uid => user.setUserField(uid, 'lastposttime', tstampByUid[uid])));
}

async function shiftPostTimes(tid, timestamp) {
	const pids = (await posts.getPidsFromSet(`tid:${tid}:posts`, 0, -1, false));
	// Leaving other related score values intact, since they reflect post order correctly, and it seems that's good enough
	return db.setObjectBulk(pids.map(pid => `post:${pid}`), pids.map((_, idx) => ({ timestamp: timestamp + idx + 1 })));
}
