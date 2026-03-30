'use strict';

const user = require('../../user');
const helpers = require('../helpers');

const sessionController = module.exports;

sessionController.get = async function (req, res) {
	const payload = res.locals.userData;
	const { username, userslug } = payload;

	payload.sessions = await user.auth.getSessions(res.locals.uid, req.sessionID);
	payload.title = '[[pages:account/sessions]]';
	payload.breadcrumbs = helpers.buildBreadcrumbs([
		{ text: username, url: `/user/${userslug}` },
		{ text: '[[pages:account/sessions]]' },
	]);

	res.render('account/sessions', payload);
};
