'use strict';

const db = require('../../database');

module.exports = {
	name: 'Add default settings for notification delivery types',
	timestamp: Date.UTC(2018, 1, 14),
	method: async function () {
		const config = await db.getObject('config');
		const postNotifications = parseInt(config.sendPostNotifications, 10) === 1 ? 'notification' : 'none';
		const chatNotifications = parseInt(config.sendChatNotifications, 10) === 1 ? 'notification' : 'none';
		await db.setObject('config', {
			notificationType_upvote: config.notificationType_upvote || 'notification',
			'notificationType_new-topic': config['notificationType_new-topic'] || 'notification',
			'notificationType_new-reply': config['notificationType_new-reply'] || postNotifications,
			notificationType_follow: config.notificationType_follow || 'notification',
			'notificationType_new-chat': config['notificationType_new-chat'] || chatNotifications,
			'notificationType_group-invite': config['notificationType_group-invite'] || 'notification',
		});
	},
};
