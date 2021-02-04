'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Create category name sorted set',
	timestamp: Date.UTC(2021, 0, 27),
	method: async function () {
		const progress = this.progress;

		await batch.processSortedSet('categories:cid', async function (cids) {
			const keys = cids.map(cid => `category:${cid}`);
			let categoryData = await db.getObjectsFields(keys, ['cid', 'name']);
			categoryData = categoryData.filter(c => c.cid && c.name);
			const bulkAdd = categoryData.map(function (cat) {
				return [
					'categories:name',
					0,
					`${String(cat.name).substr(0, 200).toLowerCase()}:${cat.cid}`,
				];
			});
			await db.sortedSetAddBulk(bulkAdd);
			progress.incr(cids.length);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
