"use strict";

var express = require('express');


function apiRoutes(router, middleware, controllers) {
	router.get('/users/csv', middleware.authenticate, controllers.admin.users.getCSV);

	var multipart = require('connect-multiparty');
	var multipartMiddleware = multipart();

	var middlewares = [multipartMiddleware, middleware.validateFiles, middleware.applyCSRF, middleware.authenticate];

	router.post('/category/uploadpicture', middlewares, controllers.admin.uploads.uploadCategoryPicture);
	router.post('/uploadfavicon', middlewares, controllers.admin.uploads.uploadFavicon);
	router.post('/uploadlogo', middlewares, controllers.admin.uploads.uploadLogo);
	router.post('/uploadgravatardefault', middlewares, controllers.admin.uploads.uploadGravatarDefault);
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
	router.get('/', controllers.admin.home);
	router.get('/general/dashboard', controllers.admin.home);
	router.get('/general/languages', controllers.admin.languages.get);
	router.get('/general/sounds', controllers.admin.sounds.get);
	router.get('/general/navigation', controllers.admin.navigation.get);
	router.get('/general/homepage', controllers.admin.homepage.get);

	router.get('/manage/categories', controllers.admin.categories.getAll);
	router.get('/manage/categories/:category_id', controllers.admin.categories.get);

	router.get('/manage/tags', controllers.admin.tags.get);

	router.get('/manage/flags', controllers.admin.flags.get);

	router.get('/manage/users', controllers.admin.users.sortByJoinDate);
	router.get('/manage/users/search', controllers.admin.users.search);
	router.get('/manage/users/latest', controllers.admin.users.sortByJoinDate);
	router.get('/manage/users/sort-posts', controllers.admin.users.sortByPosts);
	router.get('/manage/users/sort-reputation', controllers.admin.users.sortByReputation);
	router.get('/manage/users/banned', controllers.admin.users.banned);

	router.get('/manage/groups', controllers.admin.groups.get);

	router.get('/settings/:term?', controllers.admin.settings.get);

	router.get('/appearance/:term?', controllers.admin.appearance.get);

	router.get('/extend/plugins', controllers.admin.plugins.get);
	router.get('/extend/widgets', controllers.admin.extend.widgets);
	router.get('/extend/rewards', controllers.admin.extend.rewards);

	router.get('/advanced/database', controllers.admin.database.get);
	router.get('/advanced/events', controllers.admin.events.get);
	router.get('/advanced/logs', controllers.admin.logs.get);
	router.get('/advanced/post-cache', controllers.admin.postCache.get);

	router.get('/development/logger', controllers.admin.logger.get);
}

module.exports = function(app, middleware, controllers) {
	app.use('/admin/', adminRouter(middleware, controllers));
	app.use('/api/admin/', apiRouter(middleware, controllers));
};
