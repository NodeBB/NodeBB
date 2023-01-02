'use strict';

const accountHelpers = require.main.require('./src/controllers/accounts/helpers');
const helpers = require.main.require('./src/controllers/helpers');

const Controllers = module.exports;

Controllers.renderAdminPage = (req, res) => {
	res.render('admin/plugins/persona', {});
};

Controllers.renderThemeSettings = async (req, res, next) => {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
	if (!userData) {
		return next();
	}

	userData.title = '[[persona:settings.title]]';
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[persona:settings.title]]' }]);

	res.render('account/theme', userData);
};
