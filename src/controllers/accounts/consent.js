'use strict';

var async = require('async');

var db = require('../../database');
var meta = require('../../meta');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var consentController = {};

consentController.get = function (req, res, next) {
	var userData;

	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return next();
			}

			// Direct database call is used here because `gdpr_consent` is a protected user field and is automatically scrubbed from standard user data retrieval calls
			db.getObjectField('user:' + userData.uid, 'gdpr_consent', function (err, consented) {
				if (err) {
					return next(err);
				}

				userData.gdpr_consent = !!parseInt(consented, 10);

				next(null, userData);
			});
		},
	], function (err, userData) {
		if (err) {
			return next(err);
		}

		userData.digest = {
			frequency: meta.config.dailyDigestFreq,
			enabled: meta.config.dailyDigestFreq !== 'off',
		};

		userData.title = '[[user:consent.title]]';
		userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[user:consent.title]]' }]);

		res.render('account/consent', userData);
	});
};

module.exports = consentController;
