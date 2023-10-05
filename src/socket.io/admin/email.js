'use strict';

const meta = require('../../meta');
const userDigest = require('../../user/digest');
const userEmail = require('../../user/email');
const notifications = require('../../notifications');
const emailer = require('../../emailer');
const utils = require('../../utils');

const Email = module.exports;

Email.test = async function (socket, data) {
	const payload = {
		...(data.payload || {}),
		subject: '[[email:test-email.subject]]',
	};

	switch (data.template) {
		case 'digest':
			await userDigest.execute({
				interval: 'month',
				subscribers: [socket.uid],
			});
			break;

		case 'banned':
			Object.assign(payload, {
				username: 'test-user',
				until: utils.toISOString(Date.now()),
				reason: 'Test Reason',
			});
			await emailer.send(data.template, socket.uid, payload);
			break;

		case 'verify-email':
		case 'welcome':
			await userEmail.sendValidationEmail(socket.uid, {
				force: 1,
				template: data.template,
				subject: data.template === 'welcome' ? `[[email:welcome-to, ${meta.config.title || meta.config.browserTitle || 'NodeBB'}]]` : undefined,
			});
			break;

		case 'notification': {
			const notification = await notifications.create({
				type: 'test',
				bodyShort: '[[email:notif.test.short]]',
				bodyLong: '[[email:notif.test.long]]',
				nid: `uid:${socket.uid}:test`,
				path: '/',
				from: socket.uid,
			});
			await emailer.send('notification', socket.uid, {
				path: notification.path,
				subject: utils.stripHTMLTags(notification.subject || '[[notifications:new-notification]]'),
				intro: utils.stripHTMLTags(notification.bodyShort),
				body: notification.bodyLong || '',
				notification,
				showUnsubscribe: true,
			});
			break;
		}

		default:
			await emailer.send(data.template, socket.uid, payload);
			break;
	}
};
