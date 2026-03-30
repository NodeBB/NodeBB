'use strict';

const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Convert old notification digest settings',
	timestamp: Date.UTC(2017, 10, 15),
	method: async function () {
		const { progress } = this;
		progress.total = await db.sortedSetCard('users:joindate');
		await batch.processSortedSet('users:joindate', async (uids) => {

			const userSettings = await db.getObjectsFields(
				uids.map(uid => `user:${uid}:settings`),
				['sendChatNotifications', 'sendPostNotifications'],
			);

			const bulkSet = [];
			userSettings.forEach((settings, index) => {
				const set = {};
				if (settings) {
					if (parseInt(userSettings.sendChatNotifications, 10) === 1) {
						set['notificationType_new-chat'] = 'notificationemail';
					}
					if (parseInt(userSettings.sendPostNotifications, 10) === 1) {
						set['notificationType_new-reply'] = 'notificationemail';
					}
					if (Object.keys(set).length) {
						bulkSet.push([`user:${uids[index]}:settings`, set]);
					}
				}
			});
			await db.setObjectBulk(bulkSet);

			await db.deleteObjectFields(
				uids.map(uid => `user:${uid}:settings`),
				['sendChatNotifications', 'sendPostNotifications'],
			);

			progress.incr(uids.length);
		}, {
			batch: 500,
		});
	},
};
