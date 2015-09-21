'use strict';

var settingsController = {};
var async = require('async');

settingsController.get = function(req, res, next) {
	var term = req.params.term ? req.params.term : 'general';

	switch (req.params.term) {
		case 'email':
			renderEmail(req, res, next);
			break;

		default:
			res.render('admin/settings/' + term);
	}
};


function renderEmail(req, res, next) {
	var fs = require('fs'),
		path = require('path'),
		utils = require('../../../public/src/utils');

	var emailsPath = path.join(__dirname, '../../../public/templates/emails');
	utils.walk(emailsPath, function(err, emails) {
		async.map(emails, function(email, next) {
			fs.readFile(email, function(err, str) {
				next(err, {
					path: email.replace(emailsPath, '').substr(1).replace('.tpl', ''),
					fullpath: email,
					text: str.toString()
				});
			});
		}, function(err, emails) {
			res.render('admin/settings/email', {
				emails: emails.filter(function(email) {
					return email.path.indexOf('_plaintext') === -1 && email.path.indexOf('partials') === -1;
				})
			});
		});
	});
}

module.exports = settingsController;