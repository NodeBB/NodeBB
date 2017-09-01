'use strict';

var async = require('async');
var nconf = require('nconf');
var fs = require('fs');
var path = require('path');

var meta = require('../../meta');
var file = require('../../file');
var emailer = require('../../emailer');

var settingsController = module.exports;

settingsController.get = function (req, res, next) {
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
	var emailsPath = path.join(nconf.get('views_dir'), 'emails');

	async.parallel({
		emails: function (cb) {
			async.waterfall([
				function (next) {
					file.walk(emailsPath, next);
				},
				function (emails, next) {
					// exclude .jst files
					emails = emails.filter(function (email) {
						return !email.endsWith('.jst');
					});

					async.map(emails, function (email, next) {
						var path = email.replace(emailsPath, '').substr(1).replace('.tpl', '');

						async.waterfall([
							function (next) {
								fs.readFile(email, next);
							},
							function (original, next) {
								var text = meta.config['email:custom:' + path] ? meta.config['email:custom:' + path] : original.toString();

								next(null, {
									path: path,
									fullpath: email,
									text: text,
									original: original.toString(),
								});
							},
						], next);
					}, next);
				},
			], cb);
		},
		services: emailer.listServices,
	}, function (err, results) {
		if (err) {
			return next(err);
		}

		res.render('admin/settings/email', {
			emails: results.emails,
			sendable: results.emails.filter(function (email) {
				return email.path.indexOf('_plaintext') === -1 && email.path.indexOf('partials') === -1;
			}),
			services: results.services,
		});
	});
}
