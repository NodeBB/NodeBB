'use strict';

const meta = require('../../meta');
const emailer = require('../../emailer');
const notifications = require('../../notifications');

const settingsController = module.exports;

settingsController.get = async function (req, res, next) {
	const term = req.params.term ? req.params.term : 'general';

	if (term === 'email') {
		await renderEmail(req, res, next);
	} else if (term === 'user') {
		await renderUser(req, res, next);
	} else {
		res.render('admin/settings/' + term);
	}
};


async function renderEmail(req, res) {
	const [emails, services] = await Promise.all([
		emailer.getTemplates(meta.config),
		emailer.listServices(),
	]);
	res.render('admin/settings/email', {
		emails: emails,
		sendable: emails.filter(function (email) {
			return !email.path.includes('_plaintext') && !email.path.includes('partials');
		}),
		services: services,
	});
}

async function renderUser(req, res) {
	const notificationTypes = await notifications.getAllNotificationTypes();
	const notificationSettings = notificationTypes.map(function (type) {
		return {
			name: type,
			label: '[[notifications:' + type + ']]',
		};
	});
	res.render('admin/settings/user', {
		notificationSettings: notificationSettings,
	});
}
