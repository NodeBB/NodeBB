'use strict';

const validator = require('validator');

const meta = require('../../meta');
const emailer = require('../../emailer');
const notifications = require('../../notifications');
const groups = require('../../groups');
const languages = require('../../languages');
const navigationAdmin = require('../../navigation/admin');
const social = require('../../social');
const api = require('../../api');
const pagination = require('../../pagination');
const helpers = require('../helpers');
const translator = require('../../translator');

const settingsController = module.exports;

settingsController.get = async function (req, res) {
	const term = req.params.term || 'general';
	const payload = {
		title: `[[admin/menu:settings/${term}]]`,
	};
	if (term === 'general') {
		payload.routes = await helpers.getHomePageRoutes(req.uid);
		payload.postSharing = await social.getPostSharing();
		const languageData = await languages.list();
		languageData.forEach((language) => {
			language.selected = language.code === meta.config.defaultLang;
		});
		payload.languages = languageData;
		payload.autoDetectLang = meta.config.autoDetectLang;
	}
	res.render(`admin/settings/${term}`, payload);
};

settingsController.email = async (req, res) => {
	const emails = await emailer.getTemplates(meta.config);

	res.render('admin/settings/email', {
		title: '[[admin/menu:settings/email]]',
		emails: emails,
		sendable: emails.filter(e => !e.path.includes('_plaintext') && !e.path.includes('partials')).map(tpl => tpl.path),
		services: emailer.listServices(),
	});
};

settingsController.user = async (req, res) => {
	const [notificationTypes, groupData] = await Promise.all([
		notifications.getAllNotificationTypes(),
		groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
	]);
	const notificationSettings = notificationTypes.map(type => ({
		name: type,
		label: `[[notifications:${type.replace(/_/g, '-')}]]`,
	}));
	res.render('admin/settings/user', {
		title: '[[admin/menu:settings/user]]',
		notificationSettings: notificationSettings,
		groupsExemptFromNewUserRestrictions: groupData,
	});
};

settingsController.post = async (req, res) => {
	const groupData = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
	res.render('admin/settings/post', {
		title: '[[admin/menu:settings/post]]',
		groupsExemptFromPostQueue: groupData,
	});
};

settingsController.advanced = async (req, res) => {
	const groupData = await groups.getNonPrivilegeGroups('groups:createtime', 0, -1);
	res.render('admin/settings/advanced', {
		title: '[[admin/menu:settings/advanced]]',
		groupsExemptFromMaintenanceMode: groupData,
	});
};

settingsController.navigation = async function (req, res) {
	const [admin, allGroups] = await Promise.all([
		navigationAdmin.getAdmin(),
		groups.getNonPrivilegeGroups('groups:createtime', 0, -1),
	]);

	allGroups.sort((a, b) => b.system - a.system);

	admin.groups = allGroups.map(group => ({ name: group.name, displayName: group.displayName }));
	admin.enabled.forEach((enabled, index) => {
		enabled.index = index;
		enabled.selected = index === 0;
		enabled.title = translator.escape(enabled.title);
		enabled.text = translator.escape(enabled.text);
		enabled.dropdownContent = translator.escape(validator.escape(String(enabled.dropdownContent || '')));
		enabled.groups = admin.groups.map(group => ({
			displayName: group.displayName,
			selected: enabled.groups.includes(group.name),
		}));
	});

	admin.available.forEach((available) => {
		available.groups = admin.groups;
	});

	admin.navigation = admin.enabled.slice();
	admin.title = '[[admin/menu:settings/navigation]]';
	res.render('admin/settings/navigation', admin);
};

settingsController.api = async (req, res) => {
	const page = parseInt(req.query.page, 10) || 1;
	const resultsPerPage = 50;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;
	const [tokens, count] = await Promise.all([
		api.utils.tokens.list(start, stop),
		api.utils.tokens.count(),
	]);
	const pageCount = Math.ceil(count / resultsPerPage);
	res.render('admin/settings/api', {
		title: '[[admin/menu:settings/api]]',
		tokens,
		pagination: pagination.create(page, pageCount, req.query),
	});
};
