'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Remove relative_path from uploaded profile cover urls',
	timestamp: Date.UTC(2017, 3, 26),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (ids) => {
			await Promise.all(ids.map(async (uid) => {
				const url = await db.getObjectField(`user:${uid}`, 'cover:url');
				progress.incr();

				if (url) {
					const newUrl = url.replace(/^.*?\/uploads\//, '/assets/uploads/');
					await db.setObjectField(`user:${uid}`, 'cover:url', newUrl);
				}
			}));
		}, {
			progress: this.progress,
		});
	},
};
