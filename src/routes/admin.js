var nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	winston = require('winston'),

	db = require('./../database'),
	user = require('./../user'),
	groups = require('../groups'),
	topics = require('./../topics'),
	pkg = require('./../../package.json'),
	categories = require('./../categories'),
	meta = require('../meta'),
	plugins = require('../plugins'),
	events = require('./../events'),
	utils = require('./../../public/src/utils.js');



(function (Admin) {
	Admin.isAdmin = function (req, res, next) {
		user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function (err, isAdmin) {
			if (!isAdmin) {
				 res.redirect('/403');
			} else {
				next();
			}
		});
	}

	Admin.buildHeader = function (req, res, callback) {
		var custom_header = {
			'plugins': [],
			'authentication': []
		};

		user.getUserFields(req.user.uid, ['username', 'userslug', 'picture'], function(err, userData) {

			plugins.fireHook('filter:admin.header.build', custom_header, function(err, custom_header) {
				callback(err, templates['admin/header'].parse({
					csrf: res.locals.csrf_token,
					relative_path: nconf.get('relative_path'),
					plugins: custom_header.plugins,
					authentication: custom_header.authentication,
					userpicture: userData.picture,
					username: userData.username,
					userslug: userData.userslug
				}));
			});
		});
	}

	Admin.createRoutes = function (app) {
		app.all('/api/admin/*', Admin.isAdmin);
		app.all('/admin/*', Admin.isAdmin);
		app.get('/admin', Admin.isAdmin);

		(function () {
			var routes = [
				'categories/active', 'categories/disabled', 'users', 'topics', 'settings', 'themes',
				'twitter', 'facebook', 'gplus', 'database', 'events', 'motd', 'groups', 'plugins', 'logger',
				'users/latest', 'users/sort-posts', 'users/sort-reputation',
				'users/search'
			];

			for (var i = 0, ii = routes.length; i < ii; i++) {
				(function (route) {
					app.get('/admin/' + route, function (req, res) {
						Admin.buildHeader(req, res, function(err, header) {
							res.send(header + app.create_route('admin/' + route) + templates['admin/footer']);
						});
					});
				}(routes[i]));
			}

			var unit_tests = ['categories'];

			for (var i = 0, ii = unit_tests.length; i < ii; i++) {
				(function (route) {
					app.get('/admin/testing/' + route, function (req, res) {
						Admin.buildHeader(req, res, function(err, header) {
							res.send(header + app.create_route('admin/testing/' + route) + templates['admin/footer']);
						});
					});
				}(unit_tests[i]));
			}

		}());

		app.namespace('/admin', function () {
			app.get('/', function (req, res) {
				Admin.buildHeader(req, res, function(err, header) {
					res.send(header + app.create_route('admin/index') + templates['admin/footer']);
				});
			});

			app.get('/index', function (req, res) {
				Admin.buildHeader(req, res, function(err, header) {
					res.send(header + app.create_route('admin/index') + templates['admin/footer']);
				});
			});

			app.post('/category/uploadpicture', function(req, res) {
				if (!req.user)
					return res.redirect('/403');

				var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];

				if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
					res.send({
						error: 'Allowed image types are png, jpg and gif!'
					});
					return;
				}

				var tempPath = req.files.userPhoto.path;
				var extension = path.extname(req.files.userPhoto.name);

				if (!extension) {
					res.send({
						error: 'Error uploading file! Error : Invalid extension!'
					});
					return;
				}

				var filename =  'category' + utils.generateUUID() + extension;
				var uploadPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), filename);

				winston.info('Attempting upload to: ' + uploadPath);

				var is = fs.createReadStream(tempPath);
				var os = fs.createWriteStream(uploadPath);

				is.on('end', function () {
					fs.unlinkSync(tempPath);
					console.log(nconf.get('upload_url') + filename);
					res.json({
						path: nconf.get('upload_url') + filename
					});
				});

				os.on('error', function (err) {
					fs.unlinkSync(tempPath);
					winston.err(err);
				});

				is.pipe(os);
			});

			app.post('/uploadfavicon', function(req, res) {
				if (!req.user)
					return res.redirect('/403');

				var allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'];

				if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
					res.send({
						error: 'You can only upload icon file type!'
					});
					return;
				}

				var tempPath = req.files.userPhoto.path;
				var extension = path.extname(req.files.userPhoto.name);

				if (!extension) {
					res.send({
						error: 'Error uploading file! Error : Invalid extension!'
					});
					return;
				}

				var filename =  'favicon.ico';
				var uploadPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), filename);

				winston.info('Attempting upload to: ' + uploadPath);

				var is = fs.createReadStream(tempPath);
				var os = fs.createWriteStream(uploadPath);

				is.on('end', function () {
					fs.unlinkSync(tempPath);

					res.json({
						path: nconf.get('upload_url') + filename
					});
				});

				os.on('error', function (err) {
					fs.unlinkSync(tempPath);
					winston.err(err);
				});

				is.pipe(os);
			});

			app.post('/uploadlogo', function(req, res) {

				if (!req.user)
					return res.redirect('/403');

				var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];

				if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
					res.send({
						error: 'Allowed image types are png, jpg and gif!'
					});
					return;
				}

				var tempPath = req.files.userPhoto.path;
				var extension = path.extname(req.files.userPhoto.name);

				if (!extension) {
					res.send({
						error: 'Error uploading file! Error : Invalid extension!'
					});
					return;
				}

				var filename =  'site-logo' + extension;
				var uploadPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), filename);

				winston.info('Attempting upload to: ' + uploadPath);

				var is = fs.createReadStream(tempPath);
				var os = fs.createWriteStream(uploadPath);

				is.on('end', function () {
					fs.unlinkSync(tempPath);

					res.json({
						path: nconf.get('upload_url') + filename
					});
				});

				os.on('error', function (err) {
					fs.unlinkSync(tempPath);
					winston.err(err);
				});

				is.pipe(os);
			});
		});


		var custom_routes = {
			'routes': [],
			'api': []
		};

		plugins.ready(function() {
			plugins.fireHook('filter:admin.create_routes', custom_routes, function(err, custom_routes) {
				var routes = custom_routes.routes;

				for (var route in routes) {
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
				for (var route in apiRoutes) {
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


		app.namespace('/api/admin', function () {

			app.get('/index', function (req, res) {
				res.json({
					version: pkg.version,
				});
			});

			app.get('/users/search', function (req, res) {
				res.json({
					search_display: 'block',
					loadmore_display: 'none',
					users: []
				});
			});

			app.get('/users/latest', function (req, res) {
				user.getUsers('users:joindate', 0, 49, function (err, data) {
					res.json({
						search_display: 'none',
						loadmore_display: 'block',
						users: data,
						yourid: req.user.uid
					});
				});
			});

			app.get('/users/sort-posts', function (req, res) {
				user.getUsers('users:postcount', 0, 49, function (err, data) {
					res.json({
						search_display: 'none',
						loadmore_display: 'block',
						users: data,
						yourid: req.user.uid
					});
				});
			});

			app.get('/users/sort-reputation', function (req, res) {
				user.getUsers('users:reputation', 0, 49, function (err, data) {
					res.json({
						search_display: 'none',
						loadmore_display: 'block',
						users: data,
						yourid: req.user.uid
					});
				});
			});

			app.get('/users', function (req, res) {
				user.getUsers('users:joindate', 0, 49, function (err, data) {
					res.json({
						search_display: 'none',
						users: data,
						yourid: req.user.uid
					});
				});
			});

			app.get('/categories', function (req, res) {
				categories.getAllCategories(0, function (err, data) {
					res.json(data);
				});
			});

			app.get('/categories/active', function (req, res) {
				categories.getAllCategories(0, function (err, data) {
					data.categories = data.categories.filter(function (category) {
						return (!category.disabled || parseInt(category.disabled, 10) === 0);
					});
					res.json(data);
				});
			});

			app.get('/categories/disabled', function (req, res) {
				categories.getAllCategories(0, function (err, data) {
					data.categories = data.categories.filter(function (category) {
						return parseInt(category.disabled, 10) === 1;
					});
					res.json(data);
				});
			});

			app.get('/topics', function (req, res) {
				topics.getAllTopics(10, null, function (err, topics) {
					res.json({
						topics: topics,
						notopics: topics.length === 0
					});
				});
			});

			app.namespace('/database', function () {
				app.get('/', function (req, res) {
					db.info(function (err, data) {
						res.json(data);
					});
				});

				// app.get('/export', function (req, res) {
				// 	meta.db.getFile(function (err, dbFile) {
				// 		if (!err) {
				// 			res.download(dbFile, 'redis.rdb', function (err) {
				// 				console.log(err);
				// 				res.send(500);
				// 				if (err) {
				// 					res.send(500);
				// 					switch (err.code) {
				// 					case 'EACCES':
				// 						res.send(500, 'Require permissions from Redis database file: ', dbFile);
				// 						break;
				// 					default:
				// 						res.send(500);
				// 						break;
				// 					}
				// 				}
				// 			});
				// 		} else res.send(500);
				// 	});
				// });
			});

			app.get('/events', function(req, res, next) {
				events.getLog(function(err, data) {
					if(err) {
						return next(err);
					}
					res.json(200, {eventdata: data.toString()});
				});
			});

			app.get('/plugins', function (req, res) {
				plugins.showInstalled(function (err, plugins) {
					if (err || !Array.isArray(plugins)) plugins = [];

					res.json(200, {
						plugins: plugins
					});
				});
			});

			app.get('/settings', function (req, res) {
				res.json(200, {});
			});

			app.get('/motd', function (req, res) {
				res.json(200, {});
			});

			app.get('/logger', function(req, res) {
				res.json(200, {});
			});

			app.get('/themes', function (req, res) {
				res.json(200, {});
			});

			app.get('/twitter', function (req, res) {
				res.json(200, {});
			});

			app.get('/facebook', function (req, res) {
				res.json(200, {});
			});

			app.get('/gplus', function (req, res) {
				res.json(200, {});
			});

			app.get('/testing/categories', function (req, res) {
				res.json(200, {});
			});

			app.get('/groups', function (req, res) {
				groups.list({
					expand: true
				}, function (err, groups) {
					res.json(200, {
						groups: groups
					});
				});
			});
		});
	};


}(exports));
