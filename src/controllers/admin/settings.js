'use strict';

var async = require('async');

var meta = require('../../meta');
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
	async.parallel({
		emails: async.apply(emailer.getTemplates, meta.config),
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
