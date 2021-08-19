'use strict';

const _ = require('lodash');
const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'Clear purged replies and toPid',
	timestamp: Date.UTC(2020, 10, 26),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('posts:pid', async (pids) => {
			progress.incr(pids.length);
			let postData = await db.getObjects(pids.map(pid => `post:${pid}`));
			postData = postData.filter(p => p && parseInt(p.toPid, 10));
			if (!postData.length) {
				return;
			}
			const toPids = postData.map(p => p.toPid);
			const exists = await db.exists(toPids.map(pid => `post:${pid}`));
			const pidsToDelete = postData.filter((p, index) => !exists[index]).map(p => p.pid);
			await db.deleteObjectFields(pidsToDelete.map(pid => `post:${pid}`), ['toPid']);

			const repliesToDelete = _.uniq(toPids.filter((pid, index) => !exists[index]));
			await db.deleteAll(repliesToDelete.map(pid => `pid:${pid}:replies`));
		}, {
			progress: progress,
			batchSize: 500,
		});
	},
};
