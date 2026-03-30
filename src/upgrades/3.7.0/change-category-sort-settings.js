'use strict';


const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Change category sort settings',
	timestamp: Date.UTC(2024, 2, 4),
	method: async function () {
		const { progress } = this;

		const currentSort = await db.getObjectField('config', 'categoryTopicSort');
		if (currentSort === 'oldest_to_newest' || currentSort === 'newest_to_oldest') {
			await db.setObjectField('config', 'categoryTopicSort', 'recently_replied');
		}

		await batch.processSortedSet('users:joindate', async (uids) => {
			progress.incr(uids.length);
			const usersSettings = await db.getObjects(uids.map(uid => `user:${uid}:settings`));
			const bulkSet = [];
			usersSettings.forEach((userSetting, i) => {
				if (userSetting && (
					userSetting.categoryTopicSort === 'newest_to_oldest' ||
					userSetting.categoryTopicSort === 'oldest_to_newest')) {
					bulkSet.push([
						`user:${uids[i]}:settings`, { categoryTopicSort: 'recently_replied' },
					]);
				}
			});
			await db.setObjectBulk(bulkSet);
		}, {
			batch: 500,
			progress: progress,
		});
	},
};
