'use strict';

const db = require('../../database');
const meta = require('../../meta');
const helpers = require('../helpers');
const accountHelpers = require('./helpers');

const consentController = module.exports;

consentController.get = async function (req, res, next) {
	if (!meta.config.gdpr_enabled) {
		return next();
	}

	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}
	const consented = await db.getObjectField(`user:${userData.uid}`, 'gdpr_consent');
	userData.gdpr_consent = parseInt(consented, 10) === 1;
	userData.digest = {
		frequency: meta.config.dailyDigestFreq || 'off',
		enabled: meta.config.dailyDigestFreq !== 'off',
	};

	userData.title = '[[user:consent.title]]';
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[user:consent.title]]' }]);

	res.render('account/consent', userData);
};
