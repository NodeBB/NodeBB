'use strict';

const helpers = require('./helpers');

module.exports = function (app, middleware, controllers) {
	const middlewares = [middleware.pluginHooks];

	helpers.setupAdminPageRoute(app, '/admin', middleware, middlewares, controllers.admin.routeIndex);

	helpers.setupAdminPageRoute(app, '/admin/dashboard', middleware, middlewares, controllers.admin.dashboard.get);

	helpers.setupAdminPageRoute(app, '/admin/manage/categories', middleware, middlewares, controllers.admin.categories.getAll);
	helpers.setupAdminPageRoute(app, '/admin/manage/categories/:category_id', middleware, middlewares, controllers.admin.categories.get);
	helpers.setupAdminPageRoute(app, '/admin/manage/categories/:category_id/analytics', middleware, middlewares, controllers.admin.categories.getAnalytics);

	helpers.setupAdminPageRoute(app, '/admin/manage/privileges/:cid?', middleware, middlewares, controllers.admin.privileges.get);
	helpers.setupAdminPageRoute(app, '/admin/manage/tags', middleware, middlewares, controllers.admin.tags.get);

	helpers.setupAdminPageRoute(app, '/admin/manage/users', middleware, middlewares, controllers.admin.users.index);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users', middleware, middlewares, controllers.admin.users.sortByJoinDate);
	helpers.setupAdminPageRoute(app, '/admin/manage/users/search', middleware, middlewares, controllers.admin.users.search);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users/latest', middleware, middlewares, controllers.admin.users.sortByJoinDate);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users/not-validated', middleware, middlewares, controllers.admin.users.notValidated);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users/no-posts', middleware, middlewares, controllers.admin.users.noPosts);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users/top-posters', middleware, middlewares, controllers.admin.users.topPosters);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users/most-reputation', middleware, middlewares, controllers.admin.users.mostReputaion);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users/inactive', middleware, middlewares, controllers.admin.users.inactive);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users/flagged', middleware, middlewares, controllers.admin.users.flagged);
	// helpers.setupAdminPageRoute(app, '/admin/manage/users/banned', middleware, middlewares, controllers.admin.users.banned);
	helpers.setupAdminPageRoute(app, '/admin/manage/registration', middleware, middlewares, controllers.admin.users.registrationQueue);

	helpers.setupAdminPageRoute(app, '/admin/manage/admins-mods', middleware, middlewares, controllers.admin.adminsMods.get);

	helpers.setupAdminPageRoute(app, '/admin/manage/groups', middleware, middlewares, controllers.admin.groups.list);
	helpers.setupAdminPageRoute(app, '/admin/manage/groups/:name', middleware, middlewares, controllers.admin.groups.get);

	helpers.setupAdminPageRoute(app, '/admin/manage/uploads', middleware, middlewares, controllers.admin.uploads.get);
	helpers.setupAdminPageRoute(app, '/admin/manage/digest', middleware, middlewares, controllers.admin.digest.get);

	helpers.setupAdminPageRoute(app, '/admin/settings/email', middleware, middlewares, controllers.admin.settings.email);
	helpers.setupAdminPageRoute(app, '/admin/settings/user', middleware, middlewares, controllers.admin.settings.user);
	helpers.setupAdminPageRoute(app, '/admin/settings/post', middleware, middlewares, controllers.admin.settings.post);
	helpers.setupAdminPageRoute(app, '/admin/settings/languages', middleware, middlewares, controllers.admin.settings.languages);
	helpers.setupAdminPageRoute(app, '/admin/settings/navigation', middleware, middlewares, controllers.admin.settings.navigation);
	helpers.setupAdminPageRoute(app, '/admin/settings/homepage', middleware, middlewares, controllers.admin.settings.homepage);
	helpers.setupAdminPageRoute(app, '/admin/settings/social', middleware, middlewares, controllers.admin.settings.social);
	helpers.setupAdminPageRoute(app, '/admin/settings/:term?', middleware, middlewares, controllers.admin.settings.get);

	helpers.setupAdminPageRoute(app, '/admin/appearance/:term?', middleware, middlewares, controllers.admin.appearance.get);

	helpers.setupAdminPageRoute(app, '/admin/extend/plugins', middleware, middlewares, controllers.admin.plugins.get);
	helpers.setupAdminPageRoute(app, '/admin/extend/widgets', middleware, middlewares, controllers.admin.extend.widgets.get);
	helpers.setupAdminPageRoute(app, '/admin/extend/rewards', middleware, middlewares, controllers.admin.extend.rewards.get);

	helpers.setupAdminPageRoute(app, '/admin/advanced/database', middleware, middlewares, controllers.admin.database.get);
	helpers.setupAdminPageRoute(app, '/admin/advanced/events', middleware, middlewares, controllers.admin.events.get);
	helpers.setupAdminPageRoute(app, '/admin/advanced/hooks', middleware, middlewares, controllers.admin.hooks.get);
	helpers.setupAdminPageRoute(app, '/admin/advanced/logs', middleware, middlewares, controllers.admin.logs.get);
	helpers.setupAdminPageRoute(app, '/admin/advanced/errors', middleware, middlewares, controllers.admin.errors.get);
	helpers.setupAdminPageRoute(app, '/admin/advanced/errors/export', middleware, middlewares, controllers.admin.errors.export);
	helpers.setupAdminPageRoute(app, '/admin/advanced/cache', middleware, middlewares, controllers.admin.cache.get);

	helpers.setupAdminPageRoute(app, '/admin/development/logger', middleware, middlewares, controllers.admin.logger.get);
	helpers.setupAdminPageRoute(app, '/admin/development/info', middleware, middlewares, controllers.admin.info.get);

	apiRoutes(app, middleware, controllers);
};


function apiRoutes(router, middleware, controllers) {
	router.get('/api/admin/users/csv', middleware.authenticate, helpers.tryRoute(controllers.admin.users.getCSV));
	router.get('/api/admin/groups/:groupname/csv', middleware.authenticate, helpers.tryRoute(controllers.admin.groups.getCSV));
	router.get('/api/admin/analytics', middleware.authenticate, helpers.tryRoute(controllers.admin.dashboard.getAnalytics));

	const multipart = require('connect-multiparty');
	const multipartMiddleware = multipart();

	const middlewares = [multipartMiddleware, middleware.validateFiles, middleware.applyCSRF, middleware.authenticate];

	router.post('/api/admin/category/uploadpicture', middlewares, helpers.tryRoute(controllers.admin.uploads.uploadCategoryPicture));
	router.post('/api/admin/uploadfavicon', middlewares, helpers.tryRoute(controllers.admin.uploads.uploadFavicon));
	router.post('/api/admin/uploadTouchIcon', middlewares, helpers.tryRoute(controllers.admin.uploads.uploadTouchIcon));
	router.post('/api/admin/uploadMaskableIcon', middlewares, helpers.tryRoute(controllers.admin.uploads.uploadMaskableIcon));
	router.post('/api/admin/uploadlogo', middlewares, helpers.tryRoute(controllers.admin.uploads.uploadLogo));
	router.post('/api/admin/uploadOgImage', middlewares, helpers.tryRoute(controllers.admin.uploads.uploadOgImage));
	router.post('/api/admin/upload/file', middlewares, helpers.tryRoute(controllers.admin.uploads.uploadFile));
	router.post('/api/admin/uploadDefaultAvatar', middlewares, helpers.tryRoute(controllers.admin.uploads.uploadDefaultAvatar));
}
