'use strict';

const user = require('../../user');
const helpers = require('../helpers');

const sessionController = module.exports;

sessionController.get = async function (req, res) {
	const { username, userslug } = await user.getUserFields(res.locals.uid, ['username', 'userslug']);

	const payload = {
		sessions: await user.auth.getSessions(res.locals.uid, req.sessionID),
		title: '[[pages:account/sessions]]',
		breadcrumbs: helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: '[[pages:account/sessions]]' }]),
	};

	res.render('account/sessions', payload);
};
