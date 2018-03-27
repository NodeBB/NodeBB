'use strict';

var async = require('async');

var meta = require('../../meta');
var emailer = require('../../emailer');
var plugins = require('../../plugins');

var settingsController = module.exports;

settingsController.get = function (req, res, next) {
	var term = req.params.term ? req.params.term : 'general';

	switch (req.params.term) {
	case 'email':
		renderEmail(req, res, next);
		break;
	case 'user':
		renderUser(req, res, next);
		break;
	default:
		res.render('admin/settings/' + term);
	}
};


function renderEmail(req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				emails: async.apply(emailer.getTemplates, meta.config),
				services: emailer.listServices,
			}, next);
		},
		function (results) {
			res.render('admin/settings/email', {
				emails: results.emails,
				sendable: results.emails.filter(function (email) {
					return email.path.indexOf('_plaintext') === -1 && email.path.indexOf('partials') === -1;
				}),
				services: results.services,
			});
		},
	], next);
}

function renderUser(req, res, next) {
	var types = [
		'notificationType_upvote',
		'notificationType_new-topic',
		'notificationType_new-reply',
		'notificationType_follow',
		'notificationType_new-chat',
		'notificationType_group-invite',
	];

	async.waterfall([
		function (next) {
			plugins.fireHook('filter:user.notificationTypes', {
				userData: {},
				types: types,
				privilegedTypes: [],
			}, next);
		},
		function (results) {
			var notificationSettings = results.types.map(function modifyType(type) {
				return {
					name: type,
					label: '[[notifications:' + type + ']]',
				};
			});
			res.render('admin/settings/user', {
				notificationSettings: notificationSettings,
			});
		},
	], next);
}
