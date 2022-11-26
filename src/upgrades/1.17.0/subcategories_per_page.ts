'use strict';

import { primaryDB as db } from '../../database';
const batch = require('../../batch');

export default  {
	name: 'Create subCategoriesPerPage property for categories',
	timestamp: Date.UTC(2021, 0, 31),
	method: async function () {
		const { progress } = this as any;

		await batch.processSortedSet('categories:cid', async (cids) => {
			const keys = cids.map((cid) => `category:${cid}`);
			await db.setObject(keys, {
				subCategoriesPerPage: 10,
			});
			progress.incr(cids.length);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
