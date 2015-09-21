'use strict';

var settingsController = {};
var async = require('async'),
	meta = require('../../meta');

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
			var path = email.replace(emailsPath, '').substr(1).replace('.tpl', '');

			fs.readFile(email, function(err, original) {
				var text = meta.config['email:custom:' + path] ? meta.config['email:custom:' + path] : original.toString();

				next(err, {
					path: path,
					fullpath: email,
					text: text,
					original: original.toString()
				});
			});
		}, function(err, emails) {
			res.render('admin/settings/email', {
				emails: emails,
				sendable: emails.filter(function(email) {
					return email.path.indexOf('_plaintext') === -1 && email.path.indexOf('partials') === -1;
				})
			});
		});
	});
}

module.exports = settingsController;