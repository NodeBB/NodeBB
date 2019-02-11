'use strict';

var express = require('express');


function apiRoutes(router, middleware, controllers) {
	router.get('/users/csv', middleware.authenticate, controllers.admin.users.getCSV);

	var multipart = require('connect-multiparty');
	var multipartMiddleware = multipart();

	var middlewares = [multipartMiddleware, middleware.validateFiles, middleware.applyCSRF, middleware.authenticate];

	router.post('/category/uploadpicture', middlewares, controllers.admin.uploads.uploadCategoryPicture);
	router.post('/uploadfavicon', middlewares, controllers.admin.uploads.uploadFavicon);
	router.post('/uploadTouchIcon', middlewares, controllers.admin.uploads.uploadTouchIcon);
	router.post('/uploadlogo', middlewares, controllers.admin.uploads.uploadLogo);
	router.post('/uploadOgImage', middlewares, controllers.admin.uploads.uploadOgImage);
	router.post('/upload/sound', middlewares, controllers.admin.uploads.uploadSound);
	router.post('/upload/file', middlewares, controllers.admin.uploads.uploadFile);
	router.post('/uploadDefaultAvatar', middlewares, controllers.admin.uploads.uploadDefaultAvatar);
}

function adminRouter(middleware, controllers) {
	var router = express.Router();

	router.use(middleware.admin.buildHeader);

	addRoutes(router, middleware, controllers);

	return router;
}

function apiRouter(middleware, controllers) {
	var router = express.Router();

	addRoutes(router, middleware, controllers);

	apiRoutes(router, middleware, controllers);

	return router;
}

function addRoutes(router, middleware, controllers) {
	var middlewares = [middleware.pluginHooks];

	router.get('/', middlewares, controllers.admin.dashboard.get);
	router.get('/general/dashboard', middlewares, controllers.admin.dashboard.get);
	router.get('/general/languages', middlewares, controllers.admin.languages.get);
	router.get('/general/sounds', middlewares, controllers.admin.sounds.get);
	router.get('/general/navigation', middlewares, controllers.admin.navigation.get);
	router.get('/general/homepage', middlewares, controllers.admin.homepage.get);
	router.get('/general/social', middlewares, controllers.admin.social.get);

	router.get('/manage/categories', middlewares, controllers.admin.categories.getAll);
	router.get('/manage/categories/:category_id', middlewares, controllers.admin.categories.get);
	router.get('/manage/categories/:category_id/analytics', middlewares, controllers.admin.categories.getAnalytics);

	router.get('/manage/privileges/:cid?', middlewares, controllers.admin.privileges.get);
	router.get('/manage/tags', middlewares, controllers.admin.tags.get);
	router.get('/manage/post-queue', middlewares, controllers.admin.postQueue.get);
	router.get('/manage/ip-blacklist', middlewares, controllers.admin.blacklist.get);

	router.get('/manage/users', middlewares, controllers.admin.users.sortByJoinDate);
	router.get('/manage/users/search', middlewares, controllers.admin.users.search);
	router.get('/manage/users/latest', middlewares, controllers.admin.users.sortByJoinDate);
	router.get('/manage/users/not-validated', middlewares, controllers.admin.users.notValidated);
	router.get('/manage/users/no-posts', middlewares, controllers.admin.users.noPosts);
	router.get('/manage/users/top-posters', middlewares, controllers.admin.users.topPosters);
	router.get('/manage/users/most-reputation', middlewares, controllers.admin.users.mostReputaion);
	router.get('/manage/users/inactive', middlewares, controllers.admin.users.inactive);
	router.get('/manage/users/flagged', middlewares, controllers.admin.users.flagged);
	router.get('/manage/users/banned', middlewares, controllers.admin.users.banned);
	router.get('/manage/registration', middlewares, controllers.admin.users.registrationQueue);

	router.get('/manage/admins-mods', middlewares, controllers.admin.adminsMods.get);

	router.get('/manage/groups', middlewares, controllers.admin.groups.list);
	router.get('/manage/groups/:name', middlewares, controllers.admin.groups.get);

	router.get('/manage/uploads', middlewares, controllers.admin.uploads.get);

	router.get('/settings/:term?', middlewares, controllers.admin.settings.get);

	router.get('/appearance/:term?', middlewares, controllers.admin.appearance.get);

	router.get('/extend/plugins', middlewares, controllers.admin.plugins.get);
	router.get('/extend/widgets', middlewares, controllers.admin.extend.widgets.get);
	router.get('/extend/rewards', middlewares, controllers.admin.extend.rewards.get);

	router.get('/advanced/database', middlewares, controllers.admin.database.get);
	router.get('/advanced/events', middlewares, controllers.admin.events.get);
	router.get('/advanced/hooks', middlewares, controllers.admin.hooks.get);
	router.get('/advanced/logs', middlewares, controllers.admin.logs.get);
	router.get('/advanced/errors', middlewares, controllers.admin.errors.get);
	router.get('/advanced/errors/export', middlewares, controllers.admin.errors.export);
	router.get('/advanced/cache', middlewares, controllers.admin.cache.get);

	router.get('/development/logger', middlewares, controllers.admin.logger.get);
	router.get('/development/info', middlewares, controllers.admin.info.get);
}

module.exports = function (app, middleware, controllers) {
	app.use('/admin/', adminRouter(middleware, controllers));
	app.use('/api/admin/', apiRouter(middleware, controllers));
};
