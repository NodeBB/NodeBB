"use strict";

var express = require('express');


function apiRoutes(app, middleware, controllers) {
	// todo, needs to be in api namespace
	app.get('/users/csv', middleware.authenticate, controllers.admin.users.getCSV);

	app.post('/category/uploadpicture', middleware.applyCSRF, middleware.authenticate, controllers.admin.uploads.uploadCategoryPicture);
	app.post('/uploadfavicon', middleware.applyCSRF, middleware.authenticate, controllers.admin.uploads.uploadFavicon);
	app.post('/uploadlogo', middleware.applyCSRF, middleware.authenticate, controllers.admin.uploads.uploadLogo);
	app.post('/uploadgravatardefault', middleware.applyCSRF, middleware.authenticate, controllers.admin.uploads.uploadGravatarDefault);
}

function adminRouter(middleware, controllers) {
	var router = express.Router();

	router.use(middleware.admin.buildHeader);

	router.get('/', controllers.admin.home);

	addRoutes(router, middleware, controllers);

	apiRoutes(router, middleware, controllers);

	return router;
}

function apiRouter(middleware, controllers) {
	var router = express.Router();

	addRoutes(router, middleware, controllers);

	return router;
}

function addRoutes(router, middleware, controllers) {
	//main
	router.get('/index', controllers.admin.home);
	router.get('/plugins', controllers.admin.plugins.get);
	router.get('/themes', controllers.admin.themes.get);
	router.get('/languages', controllers.admin.languages.get);
	router.get('/groups', controllers.admin.groups.get);
	router.get('/sounds', controllers.admin.sounds.get);

	//settings
	router.get('/settings/:term?', middleware.applyCSRF, controllers.admin.settings.get);

	//user
	router.get('/users', controllers.admin.users.search);
	router.get('/users/search', controllers.admin.users.search);
	router.get('/users/latest', controllers.admin.users.sortByJoinDate);
	router.get('/users/sort-posts', controllers.admin.users.sortByPosts);
	router.get('/users/sort-reputation', controllers.admin.users.sortByReputation);

	//forum
	router.get('/categories/active', middleware.applyCSRF, controllers.admin.categories.active);
	router.get('/categories/disabled', middleware.applyCSRF, controllers.admin.categories.disabled);
	router.get('/tags', controllers.admin.tags.get);

	//misc
	router.get('/database', controllers.admin.database.get);
	router.get('/events', controllers.admin.events.get);
	router.get('/logger', controllers.admin.logger.get);
}

module.exports = function(app, middleware, controllers) {
	app.use('/admin/', adminRouter(middleware, controllers));
	app.use('/api/admin/', apiRouter(middleware, controllers));
};
