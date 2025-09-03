'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Move topic:<tid>:thumbs to topic hash',
	timestamp: Date.UTC(2025, 6, 5),
	method: async function () {
		const { progress } = this;

		const topicCount = await db.sortedSetCard('topics:tid');
		progress.total = topicCount;

		await batch.processSortedSet('topics:tid', async (tids) => {
			const keys = tids.map(tid => `topic:${tid}:thumbs`);

			const topicThumbData = await db.getSortedSetsMembersWithScores(keys);

			const bulkSet = [];
			topicThumbData.forEach((topicThumbs, idx) => {
				const tid = tids[idx];
				if (Array.isArray(topicThumbs) && topicThumbs.length > 0) {
					bulkSet.push([
						`topic:${tid}`,
						{ thumbs: JSON.stringify(topicThumbs.map(thumb => thumb.value)) },
					]);
				}
			});

			await db.setObjectBulk(bulkSet);
			await db.deleteAll(keys);

			progress.incr(tids.length);
		}, {
			batch: 500,
		});
	},
};
