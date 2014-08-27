"use strict";


function mainRoutes(app, middleware, controllers) {
	app.get('/admin', middleware.admin.buildHeader, controllers.admin.home);
	app.get('/admin/index', middleware.admin.buildHeader, controllers.admin.home);
	app.get('/api/admin/index', controllers.admin.home);

	app.get('/admin/plugins', middleware.admin.buildHeader, controllers.admin.plugins.get);
	app.get('/api/admin/plugins', controllers.admin.plugins.get);

	app.get('/admin/settings', middleware.admin.buildHeader, controllers.admin.settings.get);
	app.get('/api/admin/settings', controllers.admin.settings.get);

	app.get('/admin/themes', middleware.admin.buildHeader, controllers.admin.themes.get);
	app.get('/api/admin/themes', controllers.admin.themes.get);

	app.get('/admin/languages', middleware.admin.buildHeader, controllers.admin.languages.get);
	app.get('/api/admin/languages', controllers.admin.languages.get);

	app.get('/admin/groups', middleware.admin.buildHeader, controllers.admin.groups.get);
	app.get('/api/admin/groups', controllers.admin.groups.get);

	app.get('/admin/sounds', middleware.admin.buildHeader, controllers.admin.sounds.get);
	app.get('/api/admin/sounds', controllers.admin.sounds.get);
}

function userRoutes(app, middleware, controllers) {
	app.get('/admin/users/search', middleware.admin.buildHeader, controllers.admin.users.search);
	app.get('/api/admin/users/search', controllers.admin.users.search);

	app.get('/admin/users/latest', middleware.admin.buildHeader, controllers.admin.users.sortByJoinDate);
	app.get('/api/admin/users/latest', controllers.admin.users.sortByJoinDate);

	app.get('/admin/users/sort-posts', middleware.admin.buildHeader, controllers.admin.users.sortByPosts);
	app.get('/api/admin/users/sort-posts', controllers.admin.users.sortByPosts);

	app.get('/admin/users/sort-reputation', middleware.admin.buildHeader, controllers.admin.users.sortByReputation);
	app.get('/api/admin/users/sort-reputation', controllers.admin.users.sortByReputation);

	app.get('/admin/users', middleware.admin.buildHeader, controllers.admin.users.search);
	app.get('/api/admin/users', controllers.admin.users.search);
}

function forumRoutes(app, middleware, controllers) {
	app.get('/admin/categories/active', middleware.admin.buildHeader, controllers.admin.categories.active);
	app.get('/api/admin/categories/active', controllers.admin.categories.active);

	app.get('/admin/categories/disabled', middleware.admin.buildHeader, controllers.admin.categories.disabled);
	app.get('/api/admin/categories/disabled', controllers.admin.categories.disabled);

	app.get('/admin/tags', middleware.admin.buildHeader, controllers.admin.tags.get);
	app.get('/api/admin/tags', controllers.admin.tags.get);
}

function apiRoutes(app, middleware, controllers) {
	// todo, needs to be in api namespace
	app.get('/admin/users/csv', middleware.authenticate, controllers.admin.users.getCSV);

	app.post('/admin/category/uploadpicture', middleware.authenticate, controllers.admin.uploads.uploadCategoryPicture);
	app.post('/admin/uploadfavicon', middleware.authenticate, controllers.admin.uploads.uploadFavicon);
	app.post('/admin/uploadlogo', middleware.authenticate, controllers.admin.uploads.uploadLogo);
	app.post('/admin/uploadgravatardefault', middleware.authenticate, controllers.admin.uploads.uploadGravatarDefault);
}

function miscRoutes(app, middleware, controllers) {
	app.get('/admin/database', middleware.admin.buildHeader, controllers.admin.database.get);
	app.get('/api/admin/database', controllers.admin.database.get);

	app.get('/admin/events', middleware.admin.buildHeader, controllers.admin.events.get);
	app.get('/api/admin/events', controllers.admin.events.get);

	app.get('/admin/logger', middleware.admin.buildHeader, controllers.admin.logger.get);
	app.get('/api/admin/logger', controllers.admin.logger.get);
}

module.exports = function(app, middleware, controllers) {
	mainRoutes(app, middleware, controllers);
	userRoutes(app, middleware, controllers);
	forumRoutes(app, middleware, controllers);
	apiRoutes(app, middleware, controllers);
	miscRoutes(app, middleware, controllers);
};
