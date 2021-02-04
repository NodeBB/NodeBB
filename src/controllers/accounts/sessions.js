'use strict';

const user = require('../../user');
const helpers = require('../helpers');
const accountHelpers = require('./helpers');

const sessionController = module.exports;

sessionController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}

	userData.sessions = await user.auth.getSessions(userData.uid, req.sessionID);
	userData.title = '[[pages:account/sessions]]';
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[pages:account/sessions]]' }]);

	res.render('account/sessions', userData);
};
