'use strict';

const async = require('async');
const userDigest = require('../../user/digest');
const userEmail = require('../../user/email');
const notifications = require('../../notifications');
const emailer = require('../../emailer');
const utils = require('../../../public/src/utils');

const Email = module.exports;

Email.test = function (socket, data, callback) {
	const payload = {
		subject: '[[email:test-email.subject]]',
	};

	switch (data.template) {
	case 'digest':
		userDigest.execute({
			interval: 'alltime',
			subscribers: [socket.uid],
		}, callback);
		break;

	case 'banned':
		Object.assign(payload, {
			username: 'test-user',
			until: utils.toISOString(Date.now()),
			reason: 'Test Reason',
		});
		emailer.send(data.template, socket.uid, payload, callback);
		break;

	case 'welcome':
		userEmail.sendValidationEmail(socket.uid, {
			force: 1,
		}, callback);
		break;

	case 'notification':
		async.waterfall([
			function (next) {
				notifications.create({
					type: 'test',
					bodyShort: '[[email:notif.test.short]]',
					bodyLong: '[[email:notif.test.long]]',
					nid: 'uid:' + socket.uid + ':test',
					path: '/',
					from: socket.uid,
				}, next);
			},
			function (notifObj, next) {
				emailer.send('notification', socket.uid, {
					path: notifObj.path,
					subject: utils.stripHTMLTags(notifObj.subject || '[[notifications:new_notification]]'),
					intro: utils.stripHTMLTags(notifObj.bodyShort),
					body: notifObj.bodyLong || '',
					notification: notifObj,
					showUnsubscribe: true,
				}, next);
			},
		], callback);
		break;

	default:
		emailer.send(data.template, socket.uid, payload, callback);
		break;
	}
};
