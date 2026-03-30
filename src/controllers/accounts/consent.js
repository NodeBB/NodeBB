'use strict';

const db = require('../../database');
const meta = require('../../meta');
const helpers = require('../helpers');

const consentController = module.exports;

consentController.get = async function (req, res, next) {
	if (!meta.config.gdpr_enabled) {
		return next();
	}
	const payload = res.locals.userData;
	const { username, userslug } = payload;
	const consented = await db.getObjectField(`user:${res.locals.uid}`, 'gdpr_consent');

	payload.gdpr_consent = parseInt(consented, 10) === 1;
	payload.digest = {
		frequency: meta.config.dailyDigestFreq || 'off',
		enabled: meta.config.dailyDigestFreq !== 'off',
	};

	payload.title = '[[user:consent.title]]';
	payload.breadcrumbs = helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: '[[user:consent.title]]' }]);

	res.render('account/consent', payload);
};
