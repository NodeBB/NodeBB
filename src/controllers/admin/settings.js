'use strict';

const meta = require('../../meta');
const emailer = require('../../emailer');
const notifications = require('../../notifications');
const groups = require('../../groups');
const languages = require('../../languages');
const navigationAdmin = require('../../navigation/admin');
const social = require('../../social');

const helpers = require('../helpers');
const translator = require('../../../public/src/modules/translator');
const settingsController = module.exports;

settingsController.get = async function (req, res) {
	const term = req.params.term || 'general';
	res.render('admin/settings/' + term);
};

settingsController.email = async (req, res) => {
	const emails = await emailer.getTemplates(meta.config);

	res.render('admin/settings/email', {
		emails: emails,
		sendable: emails.filter(e => !e.path.includes('_plaintext') && !e.path.includes('partials')).map(tpl => tpl.path),
		services: emailer.listServices(),
	});
};

settingsController.user = async (req, res) => {
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
};

settingsController.post = async (req, res) => {
	const groupData = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
	res.render('admin/settings/post', {
		groupsExemptFromPostQueue: groupData,
	});
};

settingsController.languages = async function (req, res) {
	const languageData = await languages.list();
	languageData.forEach(function (language) {
		language.selected = language.code === meta.config.defaultLang;
	});

	res.render('admin/settings/languages', {
		languages: languageData,
		autoDetectLang: meta.config.autoDetectLang,
	});
};

settingsController.navigation = async function (req, res) {
	const [admin, allGroups] = await Promise.all([
		navigationAdmin.getAdmin(),
		groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
	]);

	allGroups.sort((a, b) => b.system - a.system);

	admin.groups = allGroups.map(group => ({ name: group.name, displayName: group.displayName }));
	admin.enabled.forEach(function (enabled, index) {
		enabled.index = index;
		enabled.selected = index === 0;
		enabled.title = translator.escape(enabled.title);
		enabled.text = translator.escape(enabled.text);
		enabled.groups = admin.groups.map(function (group) {
			return {
				displayName: group.displayName,
				selected: enabled.groups.includes(group.name),
			};
		});
	});

	admin.available.forEach(function (available) {
		available.groups = admin.groups;
	});

	admin.navigation = admin.enabled.slice();

	res.render('admin/settings/navigation', admin);
};

settingsController.homepage = async function (req, res) {
	const routes = await helpers.getHomePageRoutes(req.uid);
	res.render('admin/settings/homepage', { routes: routes });
};

settingsController.social = async function (req, res) {
	const posts = await social.getPostSharing();
	res.render('admin/settings/social', {
		posts: posts,
	});
};
