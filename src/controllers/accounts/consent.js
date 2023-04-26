'use strict';

const db = require('../../database');
const meta = require('../../meta');
const user = require('../../user');
const helpers = require('../helpers');

const consentController = module.exports;

consentController.get = async function (req, res, next) {
	if (!meta.config.gdpr_enabled) {
		return next();
	}

	const { username, userslug } = await user.getUserFields(res.locals.uid, ['username', 'userslug']);
	const consented = await db.getObjectField(`user:${res.locals.uid}`, 'gdpr_consent');

	const payload = {};
	payload.gdpr_consent = parseInt(consented, 10) === 1;
	payload.digest = {
		frequency: meta.config.dailyDigestFreq || 'off',
		enabled: meta.config.dailyDigestFreq !== 'off',
	};

	payload.title = '[[user:consent.title]]';
	payload.breadcrumbs = helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: '[[user:consent.title]]' }]);

	res.render('account/consent', payload);
};
