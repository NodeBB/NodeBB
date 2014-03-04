"use strict";

var nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	winston = require('winston'),
	async = require('async'),

	db = require('./../database'),
	user = require('./../user'),
	groups = require('../groups'),
	topics = require('./../topics'),
	pkg = require('./../../package'),
	categories = require('./../categories'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	widgets = require('../widgets'),
	image = require('./../image'),
	file = require('./../file'),
	Languages = require('../languages'),
	events = require('./../events'),
	utils = require('./../../public/src/utils'),
	templates = require('./../../public/src/templates');

var Admin = {};

function uploadImage(filename, req, res) {
	function done(err, image) {
		var er, rs;
		fs.unlink(req.files.userPhoto.path);

		if(err) {
			er = {error: err.message};
			return res.send(req.xhr ? er : JSON.stringify(er));
		}

		rs = {path: image.url};
		res.send(req.xhr ? rs : JSON.stringify(rs));
	}

	if(plugins.hasListeners('filter:uploadImage')) {
		plugins.fireHook('filter:uploadImage', req.files.userPhoto, done);
	} else {
		file.saveFileToLocal(filename, req.files.userPhoto.path, done);
	}
}

module.exports = function(app, middleware, controllers) {
	app.all('/api/admin/*', middleware.admin.isAdmin, middleware.prepareAPI);
	app.all('/admin/*', middleware.admin.isAdmin);
	app.get('/admin', middleware.admin.isAdmin);



	app.get('/admin/', middleware.admin.buildHeader, controllers.admin.home);
	app.get('/api/admin/index', controllers.admin.home);

	app.get('/admin/users/search', middleware.admin.buildHeader, controllers.admin.users.search);
	app.get('/api/admin/users/search', controllers.admin.users.search);

	app.get('/admin/users/latest', middleware.admin.buildHeader, controllers.admin.users.latest);
	app.get('/api/admin/users/latest', controllers.admin.users.latest);

	app.get('/admin/users/sort-posts', middleware.admin.buildHeader, controllers.admin.users.sortByPosts);
	app.get('/api/admin/users/sort-posts', controllers.admin.users.sortByPosts);

	app.get('/admin/users/sort-reputation', middleware.admin.buildHeader, controllers.admin.users.sortByReputation);
	app.get('/api/admin/users/sort-reputation', controllers.admin.users.sortByReputation);

	app.get('/admin/users', middleware.admin.buildHeader, controllers.admin.users.sortByJoinDate);
	app.get('/api/admin/users', controllers.admin.users.sortByJoinDate);

	app.get('/admin/categories/active', middleware.admin.buildHeader, controllers.admin.categories.active);
	app.get('/api/admin/categories/active', controllers.admin.categories.active);

	app.get('/admin/categories/disabled', middleware.admin.buildHeader, controllers.admin.categories.disabled);
	app.get('/api/admin/categories/disabled', controllers.admin.categories.disabled);

	app.get('/admin/topics', middleware.admin.buildHeader, controllers.admin.topics.get);
	app.get('/api/admin/topics', controllers.admin.topics.get);

	app.get('/admin/database', middleware.admin.buildHeader, controllers.admin.database.get);
	app.get('/api/admin/database', controllers.admin.database.get);

	app.get('/admin/events', middleware.admin.buildHeader, controllers.admin.events.get);
	app.get('/api/admin/events', controllers.admin.events.get);

	app.get('/admin/plugins', middleware.admin.buildHeader, controllers.admin.plugins.get);
	app.get('/api/admin/plugins', controllers.admin.plugins.get);

	app.get('/admin/languages', middleware.admin.buildHeader, controllers.admin.languages.get);
	app.get('/api/admin/languages', controllers.admin.languages.get);

	app.get('/admin/settings', middleware.admin.buildHeader, controllers.admin.settings.get);
	app.get('/api/admin/settings', controllers.admin.settings.get);

	app.get('/admin/logger', middleware.admin.buildHeader, controllers.admin.logger.get);
	app.get('/api/admin/logger', controllers.admin.logger.get);

	app.get('/admin/themes', middleware.admin.buildHeader, controllers.admin.themes.get);
	app.get('/api/admin/themes', controllers.admin.themes.get);

	app.get('/admin/groups', middleware.admin.buildHeader, controllers.admin.groups.get);
	app.get('/api/admin/groups', controllers.admin.groups.get);




	app.namespace('/admin', function () {
		app.post('/category/uploadpicture', function(req, res) {
			if (!req.user) {
				return res.redirect('/403');
			}

			var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'],
				params = null, er;
			try {
				params = JSON.parse(req.body.params);
			} catch (e) {
				er = {
					error: 'Error uploading file! Error :' + e.message
				};
				return res.send(req.xhr ? er : JSON.stringify(er));
			}

			if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
				er = {
					error: 'Allowed image types are png, jpg and gif!'
				};
				res.send(req.xhr ? er : JSON.stringify(er));
				return;
			}

			var filename =  'category-' + params.cid + path.extname(req.files.userPhoto.name);

			uploadImage(filename, req, res);
		});

		app.post('/uploadfavicon', function(req, res) {
			if (!req.user) {
				return res.redirect('/403');
			}

			var allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'],
				er;

			if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
				er = {error: 'You can only upload icon file type!'};
				res.send(req.xhr ? er : JSON.stringify(er));
				return;
			}

			file.saveFileToLocal('favicon.ico', req.files.userPhoto.path, function(err, image) {
				fs.unlink(req.files.userPhoto.path);

				if(err) {
					er = {error: err.message};
					return res.send(req.xhr ? er : JSON.stringify(er));
				}

				var rs = {path: image.url};
				res.send(req.xhr ? rs : JSON.stringify(rs));
			});
		});

		app.post('/uploadlogo', function(req, res) {

			if (!req.user) {
				return res.redirect('/403');
			}

			var allowedTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif'],
				er;

			if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
				er = {error: 'Allowed image types are png, jpg and gif!'};
				res.send(req.xhr ? er : JSON.stringify(er));
				return;
			}

			var filename = 'site-logo' + path.extname(req.files.userPhoto.name);

			uploadImage(filename, req, res);
		});

		app.get('/users/csv', function(req, res) {
			user.getUsersCSV(function(err, data) {
				res.attachment('users.csv');
				res.setHeader('Content-Type', 'text/csv');
				res.end(data);
			});
		});
	});

	var custom_routes = {
		'routes': [],
		'api': []
	};

	plugins.ready(function() {
		plugins.fireHook('filter:admin.create_routes', custom_routes, function(err, custom_routes) {
			var route, routes = custom_routes.routes;

			for (route in routes) {
				if (routes.hasOwnProperty(route)) {
					(function(route) {
						app[routes[route].method || 'get']('/admin' + routes[route].route, function(req, res) {
							routes[route].options(req, res, function(options) {
								Admin.buildHeader(req, res, function (err, header) {
									res.send(header + options.content + templates['admin/footer']);
								});
							});
						});
					}(route));
				}
			}

			var apiRoutes = custom_routes.api;
			for (route in apiRoutes) {
				if (apiRoutes.hasOwnProperty(route)) {
					(function(route) {
						app[apiRoutes[route].method || 'get']('/api/admin' + apiRoutes[route].route, function(req, res) {
							apiRoutes[route].callback(req, res, function(data) {
								res.json(data);
							});
						});
					}(route));
				}
			}
		});
	});
};
