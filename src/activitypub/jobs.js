'use strict';

const db = require('../database');
const meta = require('../meta');
const topics = require('../topics');
const utils = require('../utils');
const cron = require('../cron');

const activitypub = module.parent.exports;

const Jobs = module.exports;

Jobs.start = async () => {
	activitypub.helpers.log('[activitypub/jobs] Registering jobs.');
	async function tryCronJob(method) {
		if (meta.config.activitypubEnabled) {
			await method();
		}
	}

	await cron.addJob({
		name: 'ap:notes:prune',
		cronTime: '0 0 * * *',
		runOnInit: false,
		onTick: async () => {
			await tryCronJob(async () => {
				await activitypub.notes.prune();
				await db.sortedSetsRemoveRangeByScore(['activities:datetime'], '-inf', Date.now() - 604800000);
			});
		},
	});

	await cron.addJob({
		name: 'ap:actors:prune',
		cronTime: '*/30 * * * *',
		runOnInit: false,
		onTick: async () => await tryCronJob(activitypub.actors.prune),
	});

	await cron.addJob({
		name: 'ap:backfill',
		cronTime: '15 * * * *',
		runOnInit: false,
		onTick: async () => await tryCronJob(backfill),
	});

	await cron.addJob({
		name: 'ap:blocklist:refresh',
		cronTime: '15 0 * * *',
		runOnInit: false,
		onTick: async () => {
			await tryCronJob(async () => {
				const lists = await activitypub.blocklists.list();
				await Promise.all(lists.map(({ url }) => {
					return activitypub.blocklists.refresh(url);
				}));
			});
		},
	});

	await cron.addJob({
		name: 'ap:analytics',
		cronTime: '30 0 * * *',
		runOnInit: false,
		onTick: async () => {
			await tryCronJob(async () => {
				// Delete entries older than 24h
				await db.sortedSetsRemoveRangeByScore(['ap.errors'], '-inf', Date.now() - (1000 * 60 * 60 * 24));
			});
		},
	});

	// Start draining the send retry queue so tasks left over from a previous
	// run are retried without waiting for the next outgoing send
	if (meta.config.activitypubEnabled) {
		activitypub.SendPool.drainLoop();
	}
};

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
