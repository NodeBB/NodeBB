'use strict';

const winston = require('winston');
const { CronJob } = require('cron');

const db = require('../database');
const meta = require('../meta');
const topics = require('../topics');
const utils = require('../utils');
const activitypub = module.parent.exports;

const Jobs = module.exports;

Jobs.start = () => {
	activitypub.helpers.log('[activitypub/jobs] Registering jobs.');
	async function tryCronJob(method) {
		if (!meta.config.activitypubEnabled) {
			return;
		}
		try {
			await method();
		} catch (err) {
			winston.error(err.stack);
		}
	}
	new CronJob('0 0 * * *', async () => {
		await tryCronJob(async () => {
			await activitypub.notes.prune();
			await db.sortedSetsRemoveRangeByScore(['activities:datetime'], '-inf', Date.now() - 604800000);
		});
	}, null, true, null, null, false); // change last argument to true for debugging

	new CronJob('*/30 * * * *', async () => {
		await tryCronJob(activitypub.actors.prune);
	}, null, true, null, null, false); // change last argument to true for debugging

	new CronJob('0 * * * * *', async () => {
		await tryCronJob(retryFailedMessages);
	}, null, true, null, null, false); // change last argument to true for debugging

	new CronJob('15 * * * *', async () => {
		await tryCronJob(backfill);
	}, null, true, null, null, false); // change last argument to true for debugging
};

async function retryFailedMessages() {
	const queueIds = await db.getSortedSetRangeByScore('ap:retry:queue', 0, 50, '-inf', Date.now());
	const queuedData = (await db.getObjects(queueIds.map(id => `ap:retry:queue:${id}`)));

	const retryQueueAdd = [];
	const retryQueuedSet = [];
	const queueIdsToRemove = [];

	const oneMinute = 1000 * 60;
	await Promise.all(queuedData.map(async (data, index) => {
		const queueId = queueIds[index];
		if (!data) {
			queueIdsToRemove.push(queueId);
			return;
		}

		const { uri, id, type, attempts, payload } = data;
		if (!uri || !id || !type || !payload || attempts > 10) {
			queueIdsToRemove.push(queueId);
			return;
		}
		let payloadObj;
		try {
			payloadObj = JSON.parse(payload);
		} catch (err) {
			queueIdsToRemove.push(queueId);
			return;
		}
		const ok = await activitypub._sendMessage(uri, id, type, payloadObj);
		if (ok) {
			queueIdsToRemove.push(queueId);
		} else {
			const nextAttempt = (parseInt(attempts, 10) || 0) + 1;
			const timeout = (2 ** nextAttempt) * oneMinute; // exponential backoff
			const nextTryOn = Date.now() + timeout;
			retryQueueAdd.push(['ap:retry:queue', nextTryOn, queueId]);
			retryQueuedSet.push([`ap:retry:queue:${queueId}`, {
				attempts: nextAttempt,
				timestamp: nextTryOn,
			}]);
		}
	}));

	await Promise.all([
		db.sortedSetAddBulk(retryQueueAdd),
		db.setObjectBulk(retryQueuedSet),
		db.sortedSetRemove('ap:retry:queue', queueIdsToRemove),
		db.deleteAll(queueIdsToRemove.map(id => `ap:retry:queue:${id}`)),
	]);
}

async function backfill() {
	const start = 0;
	const stop = meta.config.topicsPerPage - 1;
	const sorted = await topics.getSortedTopics({
		term: 'day',
		sort: 'posts',
		uid: 0,
		start,
		stop,
	});

	// Remote mainPids only
	const pids = sorted.topics
		.map(({ mainPid }) => mainPid)
		.filter(pid => !utils.isNumber(pid));

	await activitypub.notes.backfill(pids);
}
