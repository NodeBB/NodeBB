'use strict';

const db = require('../../database');

module.exports = {
	name: 'Fix category colors that are 3 digit hex colors',
	timestamp: Date.UTC(2020, 9, 11),
	method: async () => {
		const batch = require('../../batch');
		await batch.processSortedSet('categories:cid', async (cids) => {
			let categoryData = await db.getObjects(cids.map(c => `category:${c}`));
			categoryData = categoryData.filter(c => c && (c.color === '#fff' || c.color === '#333' || String(c.color).length !== 7));
			if (categoryData.length) {
				await Promise.all(categoryData.map(async (data) => {
					const color = `#${new Array(6).fill((data.color && data.color[1]) || 'f').join('')}`;
					await db.setObjectField(`category:${data.cid}`, 'color', color);
				}));
			}
		}, { batch: 500 });
	},
};
