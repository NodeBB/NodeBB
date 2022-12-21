'use strict';

const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Convert old notification digest settings',
	timestamp: Date.UTC(2017, 10, 15),
	method: async function () {
		const { progress } = this;

		await batch.processSortedSet('users:joindate', async (uids) => {
			await Promise.all(uids.map(async (uid) => {
				progress.incr();
				const userSettings = await db.getObjectFields(`user:${uid}:settings`, ['sendChatNotifications', 'sendPostNotifications']);
				if (userSettings) {
					if (parseInt(userSettings.sendChatNotifications, 10) === 1) {
						await db.setObjectField(`user:${uid}:settings`, 'notificationType_new-chat', 'notificationemail');
					}
					if (parseInt(userSettings.sendPostNotifications, 10) === 1) {
						await db.setObjectField(`user:${uid}:settings`, 'notificationType_new-reply', 'notificationemail');
					}
				}
				await db.deleteObjectFields(`user:${uid}:settings`, ['sendChatNotifications', 'sendPostNotifications']);
			}));
		}, {
			progress: progress,
			batch: 500,
		});
	},
};
