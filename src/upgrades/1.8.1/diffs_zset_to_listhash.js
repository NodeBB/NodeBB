'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Reformatting post diffs to be stored in lists and hash instead of single zset',
	timestamp: Date.UTC(2018, 2, 15),
	method: async function () {
		const { progress } = this;

		progress.total = await db.sortedSetCard('posts:pid');

		await batch.processSortedSet('posts:pid', async (pids) => {
			const postDiffs = await db.getSortedSetsMembersWithScores(
				pids.map(pid => `post:${pid}:diffs`),
			);

			await db.deleteAll(pids.map(pid => `post:${pid}:diffs`));

			await Promise.all(postDiffs.map(async (diffs, index) => {
				if (!diffs || !diffs.length) {
					return;
				}
				diffs.reverse();
				const pid = pids[index];
				await db.listAppend(`post:${pid}:diffs`, diffs.map(d => d.score));
				await db.setObjectBulk(
					diffs.map(d => ([`diff:${pid}.${d.score}`, {
						pid: pid,
						patch: d.value,
					}]))
				);
			}));
			progress.incr(pids.length);
		}, {
			batch: 500,
		});
	},
};
