'use strict';

const db = require('../../database');

module.exports = {
	name: 'Favourites to Bookmarks',
	timestamp: Date.UTC(2016, 9, 8),
	method: async function () {
		const { progress } = this;
		const batch = require('../../batch');

		async function upgradePosts() {
			await batch.processSortedSet('posts:pid', async (ids) => {
				await Promise.all(ids.map(async (id) => {
					progress.incr();
					await db.rename(`pid:${id}:users_favourited`, `pid:${id}:users_bookmarked`);
					const reputation = await db.getObjectField(`post:${id}`, 'reputation');
					if (parseInt(reputation, 10)) {
						await db.setObjectField(`post:${id}`, 'bookmarks', reputation);
					}
					await db.deleteObjectField(`post:${id}`, 'reputation');
				}));
			}, {
				progress: progress,
			});
		}

		async function upgradeUsers() {
			await batch.processSortedSet('users:joindate', async (ids) => {
				await Promise.all(ids.map(async (id) => {
					await db.rename(`uid:${id}:favourites`, `uid:${id}:bookmarks`);
				}));
			}, {});
		}

		await upgradePosts();
		await upgradeUsers();
	},
};
