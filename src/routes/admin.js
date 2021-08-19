'use strict';

const helpers = require('./helpers');

module.exports = function (app, name, middleware, controllers) {
	const middlewares = [middleware.pluginHooks];

	helpers.setupAdminPageRoute(app, `/${name}`, middleware, middlewares, controllers.admin.routeIndex);

	helpers.setupAdminPageRoute(app, `/${name}/dashboard`, middleware, middlewares, controllers.admin.dashboard.get);
	helpers.setupAdminPageRoute(app, `/${name}/dashboard/logins`, middleware, middlewares, controllers.admin.dashboard.getLogins);
	helpers.setupAdminPageRoute(app, `/${name}/dashboard/users`, middleware, middlewares, controllers.admin.dashboard.getUsers);
	helpers.setupAdminPageRoute(app, `/${name}/dashboard/topics`, middleware, middlewares, controllers.admin.dashboard.getTopics);

	helpers.setupAdminPageRoute(app, `/${name}/manage/categories`, middleware, middlewares, controllers.admin.categories.getAll);
	helpers.setupAdminPageRoute(app, `/${name}/manage/categories/:category_id`, middleware, middlewares, controllers.admin.categories.get);
	helpers.setupAdminPageRoute(app, `/${name}/manage/categories/:category_id/analytics`, middleware, middlewares, controllers.admin.categories.getAnalytics);

	helpers.setupAdminPageRoute(app, `/${name}/manage/privileges/:cid?`, middleware, middlewares, controllers.admin.privileges.get);
	helpers.setupAdminPageRoute(app, `/${name}/manage/tags`, middleware, middlewares, controllers.admin.tags.get);

	helpers.setupAdminPageRoute(app, `/${name}/manage/users`, middleware, middlewares, controllers.admin.users.index);
	helpers.setupAdminPageRoute(app, `/${name}/manage/registration`, middleware, middlewares, controllers.admin.users.registrationQueue);

	helpers.setupAdminPageRoute(app, `/${name}/manage/admins-mods`, middleware, middlewares, controllers.admin.adminsMods.get);

	helpers.setupAdminPageRoute(app, `/${name}/manage/groups`, middleware, middlewares, controllers.admin.groups.list);
	helpers.setupAdminPageRoute(app, `/${name}/manage/groups/:name`, middleware, middlewares, controllers.admin.groups.get);

	helpers.setupAdminPageRoute(app, `/${name}/manage/uploads`, middleware, middlewares, controllers.admin.uploads.get);
	helpers.setupAdminPageRoute(app, `/${name}/manage/digest`, middleware, middlewares, controllers.admin.digest.get);

	helpers.setupAdminPageRoute(app, `/${name}/settings/email`, middleware, middlewares, controllers.admin.settings.email);
	helpers.setupAdminPageRoute(app, `/${name}/settings/user`, middleware, middlewares, controllers.admin.settings.user);
	helpers.setupAdminPageRoute(app, `/${name}/settings/post`, middleware, middlewares, controllers.admin.settings.post);
	helpers.setupAdminPageRoute(app, `/${name}/settings/languages`, middleware, middlewares, controllers.admin.settings.languages);
	helpers.setupAdminPageRoute(app, `/${name}/settings/navigation`, middleware, middlewares, controllers.admin.settings.navigation);
	helpers.setupAdminPageRoute(app, `/${name}/settings/homepage`, middleware, middlewares, controllers.admin.settings.homepage);
	helpers.setupAdminPageRoute(app, `/${name}/settings/social`, middleware, middlewares, controllers.admin.settings.social);
	helpers.setupAdminPageRoute(app, `/${name}/settings/:term?`, middleware, middlewares, controllers.admin.settings.get);

	helpers.setupAdminPageRoute(app, `/${name}/appearance/:term?`, middleware, middlewares, controllers.admin.appearance.get);

	helpers.setupAdminPageRoute(app, `/${name}/extend/plugins`, middleware, middlewares, controllers.admin.plugins.get);
	helpers.setupAdminPageRoute(app, `/${name}/extend/widgets`, middleware, middlewares, controllers.admin.extend.widgets.get);
	helpers.setupAdminPageRoute(app, `/${name}/extend/rewards`, middleware, middlewares, controllers.admin.extend.rewards.get);

	helpers.setupAdminPageRoute(app, `/${name}/advanced/database`, middleware, middlewares, controllers.admin.database.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/events`, middleware, middlewares, controllers.admin.events.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/hooks`, middleware, middlewares, controllers.admin.hooks.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/logs`, middleware, middlewares, controllers.admin.logs.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/errors`, middleware, middlewares, controllers.admin.errors.get);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/errors/export`, middleware, middlewares, controllers.admin.errors.export);
	helpers.setupAdminPageRoute(app, `/${name}/advanced/cache`, middleware, middlewares, controllers.admin.cache.get);

	helpers.setupAdminPageRoute(app, `/${name}/development/logger`, middleware, middlewares, controllers.admin.logger.get);
	helpers.setupAdminPageRoute(app, `/${name}/development/info`, middleware, middlewares, controllers.admin.info.get);

	apiRoutes(app, name, middleware, controllers);
};


function apiRoutes(router, name, middleware, controllers) {
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
