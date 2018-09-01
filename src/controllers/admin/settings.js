'use strict';

var async = require('async');

var meta = require('../../meta');
var emailer = require('../../emailer');
var notifications = require('../../notifications');

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
	async.waterfall([
		function (next) {
			notifications.getAllNotificationTypes(next);
		},
		function (notificationTypes) {
			var notificationSettings = notificationTypes.map(function (type) {
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
