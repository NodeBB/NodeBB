'use strict';

const meta = require('../../meta');
const emailer = require('../../emailer');
const notifications = require('../../notifications');
const groups = require('../../groups');

const settingsController = module.exports;

settingsController.get = async function (req, res, next) {
	const term = req.params.term ? req.params.term : 'general';

	if (term === 'email') {
		await renderEmail(req, res, next);
	} else if (term === 'user') {
		await renderUser(req, res, next);
	} else if (term === 'post') {
		await renderPost(req, res, next);
	} else {
		res.render('admin/settings/' + term);
	}
};


async function renderEmail(req, res) {
	const emails = await emailer.getTemplates(meta.config);

	res.render('admin/settings/email', {
		emails: emails,
		sendable: emails.filter(e => !e.path.includes('_plaintext') && !e.path.includes('partials')),
		services: emailer.listServices(),
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

async function renderPost(req, res) {
	const groupData = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
	res.render('admin/settings/post', {
		groupsExemptFromPostQueue: groupData,
	});
}
