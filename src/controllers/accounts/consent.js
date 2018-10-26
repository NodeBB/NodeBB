'use strict';

var async = require('async');

var db = require('../../database');
var meta = require('../../meta');
var helpers = require('../helpers');
var accountHelpers = require('./helpers');

var consentController = module.exports;

consentController.get = function (req, res, next) {
	if (!meta.config.gdpr_enabled) {
		// GDPR disabled
		return next();
	}

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
			db.getObjectField('user:' + userData.uid, 'gdpr_consent', next);
		},
		function (consented) {
			userData.gdpr_consent = parseInt(consented, 10) === 1;
			userData.digest = {
				frequency: meta.config.dailyDigestFreq,
				enabled: meta.config.dailyDigestFreq !== 'off',
			};

			userData.title = '[[user:consent.title]]';
			userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[user:consent.title]]' }]);

			res.render('account/consent', userData);
		},
	], next);
};
