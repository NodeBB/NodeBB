'use strict';

const db = require('../../database');
const batch = require('../../batch');
const utils = require('../../utils');

module.exports = {
	name: 'Remove AP tids from topics:recent, topics:views, topics:posts, topics:votes zsets',
	timestamp: Date.UTC(2026, 0, 25),
	method: async function () {
		const { progress } = this;
		const [recent, views, posts, votes] = await db.sortedSetsCard([
			'topics:recent', 'topics:views', 'topics:posts', 'topics:votes',
		]);
		progress.total = recent + views + posts + votes;

		async function cleanupSet(setName) {
			const tidsToRemove = [];
			await batch.processSortedSet(setName, async (tids) => {
				const topicData = await db.getObjectsFields(tids.map(tid => `topic:${tid}`), ['cid']);
				topicData.forEach((t, index) => {
					if (t) {
						t.tid = tids[index];
					}
				});
				const batchTids = topicData.filter(
					t => t && (!t.cid || !utils.isNumber(t.cid) || t.cid === -1)
				).map(t => t.tid);

				tidsToRemove.push(...batchTids);
				progress.incr(tids.length);
			}, {
				batch: 500,
			});

			await batch.processArray(tidsToRemove, async (batchTids) => {
				await db.sortedSetRemove(setName, batchTids);
			}, {
				batch: 500,
			});

		}
		await cleanupSet('topics:recent');
		await cleanupSet('topics:views');
		await cleanupSet('topics:posts');
		await cleanupSet('topics:votes');
	},
};
