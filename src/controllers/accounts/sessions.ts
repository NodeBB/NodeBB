'use strict';

import user from '../../user';
import helpers from '../helpers';
const accountHelpers = require('./helpers').defualt;

const sessionController  = {} as any;

sessionController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
	if (!userData) {
		return next();
	}

	userData.sessions = await user.auth.getSessions(userData.uid, req.sessionID);
	userData.title = '[[pages:account/sessions]]';
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[pages:account/sessions]]' }]);

	res.render('account/sessions', userData);
};
