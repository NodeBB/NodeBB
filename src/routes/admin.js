'use strict';

const helpers = require('./helpers');

module.exports = function (app, name, middleware, controllers) {
	const middlewares = [middleware.pluginHooks];

	helpers.setupAdminPageRoute(app, `/${name}`, middlewares, controllers.admin.routeIndex);

	helpers.setupAdminPageRoute(app, `/${name}/dashboard`, middlewares, controllers.admin.dashboard.get);
	helpers.setupAdminPageRoute(app, `/${name}/dashboard/logins`, middlewares, controllers.admin.dashboard.getLogins);
	helpers.setupAdminPageRoute(app, `/${name}/dashboard/users`, middlewares, controllers.admin.dashboard.getUsers);
	helpers.setupAdminPageRoute(app, `/${name}/dashboard/topics`, middlewares, controllers.admin.dashboard.getTopics);
	helpers.setupAdminPageRoute(app, `/${name}/dashboard/searches`, middlewares, controllers.admin.dashboard.getSearches);

	helpers.setupAdminPageRoute(app, `/${name}/manage/categories`, middlewares, controllers.admin.categories.getAll);
	helpers.setupAdminPageRoute(app, `/${name}/manage/categories/:category_id`, middlewares, controllers.admin.categories.get);
	helpers.setupAdminPageRoute(app, `/${name}/manage/categories/:category_id/analytics`, middlewares, controllers.admin.categories.getAnalytics);

	helpers.setupAdminPageRoute(app, `/${name}/manage/privileges/:cid?`, middlewares, controllers.admin.privileges.get);
	helpers.setupAdminPageRoute(app, `/${name}/manage/tags`, middlewares, controllers.admin.tags.get);

	helpers.setupAdminPageRoute(app, `/${name}/manage/users`, middlewares, controllers.admin.users.index);
	helpers.setupAdminPageRoute(app, `/${name}/manage/registration`, middlewares, controllers.admin.users.registrationQueue);

	helpers.setupAdminPageRoute(app, `/${name}/manage/admins-mods`, middlewares, controllers.admin.adminsMods.get);

	helpers.setupAdminPageRoute(app, `/${name}/manage/groups`, middlewares, controllers.admin.groups.list);
	helpers.setupAdminPageRoute(app, `/${name}/manage/groups/:name`, middlewares, controllers.admin.groups.get);

	helpers.setupAdminPageRoute(app, `/${name}/manage/uploads`, middlewares, controllers.admin.uploads.get);
	helpers.setupAdminPageRoute(app, `/${name}/manage/digest`, middlewares, controllers.admin.digest.get);

	helpers.setupAdminPageRoute(app, `/${name}/settings/email`, middlewares, controllers.admin.settings.email);
	helpers.setupAdminPageRoute(app, `/${name}/settings/user`, middlewares, controllers.admin.settings.user);
	helpers.setupAdminPageRoute(app, `/${name}/settings/post`, middlewares, controllers.admin.settings.post);
	helpers.setupAdminPageRoute(app, `/${name}/settings/advanced`, middlewares, controllers.admin.settings.advanced);
	helpers.setupAdminPageRoute(app, `/${name}/settings/navigation`, middlewares, controllers.admin.settings.navigation);
	helpers.setupAdminPageRoute(app, `/${name}/settings/api`, middlewares, controllers.admin.settings.api);
	helpers.setupAdminPageRoute(app, `/${name}/settings/:term?`, middlewares, controllers.admin.settings.get);

	helpers.setupAdminPageRoute(app, `/${name}/appearance/:term?`, middlewares, controllers.admin.appearance.get);

	helpers.setupAdminPageRoute(app, `/${name}/extend/plugins`, middlewares, controllers.admin.plugins.get);
	helpers.setupAdminPageRoute(app, `/${name}/extend/widgets`, middlewares, controllers.admin.extend.widgets.get);
	helpers.setupAdminPageRoute(app, `/${name}/extend/rewards`, middlewares, controllers.admin.extend.rewards.get);

	helpers.setupAdminPageRoute(app, `/${name}/advanced/database`, middlewares, controllers.admin.database.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/events`, middlewares, controllers.admin.events.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/hooks`, middlewares, controllers.admin.hooks.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/logs`, middlewares, controllers.admin.logs.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/errors`, middlewares, controllers.admin.errors.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/errors/export`, middlewares, controllers.admin.errors.export);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/cache`, middlewares, controllers.admin.cache.get);

	helpers.setupAdminPageRoute(app, `/${name}/development/logger`, middlewares, controllers.admin.logger.get);
	helpers.setupAdminPageRoute(app, `/${name}/development/info`, middlewares, controllers.admin.info.get);

	apiRoutes(app, name, middleware, controllers);
};


function apiRoutes(router, name, middleware, controllers) {
	router.get(`/api/${name}/config`, middleware.ensureLoggedIn, helpers.tryRoute(controllers.admin.getConfig));
	router.get(`/api/${name}/users/csv`, middleware.ensureLoggedIn, helpers.tryRoute(controllers.admin.users.getCSV));
	router.get(`/api/${name}/groups/:groupname/csv`, middleware.ensureLoggedIn, helpers.tryRoute(controllers.admin.groups.getCSV));
	router.get(`/api/${name}/analytics`, middleware.ensureLoggedIn, helpers.tryRoute(controllers.admin.dashboard.getAnalytics));
	router.get(`/api/${name}/advanced/cache/dump`, middleware.ensureLoggedIn, helpers.tryRoute(controllers.admin.cache.dump));

	const multipart = require('connect-multiparty');
	const multipartMiddleware = multipart();

	const middlewares = [multipartMiddleware, middleware.validateFiles, middleware.applyCSRF, middleware.ensureLoggedIn];

	router.post(`/api/${name}/category/uploadpicture`, middlewares, helpers.tryRoute(controllers.admin.uploads.uploadCategoryPicture));
	router.post(`/api/${name}/uploadfavicon`, middlewares, helpers.tryRoute(controllers.admin.uploads.uploadFavicon));
	router.post(`/api/${name}/uploadTouchIcon`, middlewares, helpers.tryRoute(controllers.admin.uploads.uploadTouchIcon));
	router.post(`/api/${name}/uploadMaskableIcon`, middlewares, helpers.tryRoute(controllers.admin.uploads.uploadMaskableIcon));
	router.post(`/api/${name}/uploadlogo`, middlewares, helpers.tryRoute(controllers.admin.uploads.uploadLogo));
	router.post(`/api/${name}/uploadOgImage`, middlewares, helpers.tryRoute(controllers.admin.uploads.uploadOgImage));
	router.post(`/api/${name}/upload/file`, middlewares, helpers.tryRoute(controllers.admin.uploads.uploadFile));
	router.post(`/api/${name}/uploadDefaultAvatar`, middlewares, helpers.tryRoute(controllers.admin.uploads.uploadDefaultAvatar));
}
