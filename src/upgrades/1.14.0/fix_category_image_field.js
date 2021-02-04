'use strict';

const db = require('../../database');

module.exports = {
	name: 'Remove duplicate image field for categories',
	timestamp: Date.UTC(2020, 5, 9),
	method: async () => {
		const batch = require('../../batch');
		await batch.processSortedSet('categories:cid', async (cids) => {
			let categoryData = await db.getObjects(cids.map(c => `category:${c}`));
			categoryData = categoryData.filter(c => c && (c.image || c.backgroundImage));
			if (categoryData.length) {
				await Promise.all(categoryData.map(async (data) => {
					if (data.image && !data.backgroundImage) {
						await db.setObjectField(`category:${data.cid}`, 'backgroundImage', data.image);
					}
					await db.deleteObjectField(`category:${data.cid}`, 'image', data.image);
				}));
			}
		}, { batch: 500 });
	},
};
