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

(function (Admin) {
	Admin.isAdmin = function (req, res, next) {
		user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function (err, isAdmin) {
			if (!isAdmin) {
				res.status(403);
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
					userslug: userData.userslug,
					'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
					env: process.env.NODE_ENV ? true : false
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
				'database', 'events', 'motd', 'groups', 'plugins', 'languages', 'logger',
				'users/latest', 'users/sort-posts', 'users/sort-reputation', 'users/search'
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
					emailerInstalled: plugins.hasListeners('action:email.send'),
					searchInstalled: plugins.hasListeners('filter:search.query')
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
						return !category.disabled;
					});
					res.json(data);
				});
			});

			app.get('/categories/disabled', function (req, res) {
				categories.getAllCategories(0, function (err, data) {
					data.categories = data.categories.filter(function (category) {
						return category.disabled;
					});
					res.json(data);
				});
			});

			app.get('/topics', function (req, res) {
				topics.getAllTopics(0, 19, function (err, topics) {
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
			});

			app.get('/events', function(req, res, next) {
				events.getLog(function(err, data) {
					if(err) {
						return next(err);
					}
					if(data) {
						data = data.toString().split('\n').reverse().join('\n');
					}
					res.json(200, {eventdata: data});
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

			app.get('/languages', function(req, res) {
				Languages.list(function(err, languages) {
					res.send(200, {
						languages: languages
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
				async.parallel({
					areas: function(next) {
						plugins.fireHook('filter:widgets.getAreas', [], next);
					},
					widgets: function(next) {
						plugins.fireHook('filter:widgets.getWidgets', [], next);
					}
				}, function(err, data) {
					async.each(data.areas, function(area, next) {
						widgets.getArea(area.template, area.location, function(err, areaData) {
							area.data = areaData;
							next(err);
						});
					}, function(err) {
						for (var w in data.widgets) {
							if (data.widgets.hasOwnProperty(w)) {
								data.widgets[w].content += "<br /><label>Title:</label><input type=\"text\" class=\"form-control\" name=\"title\" placeholder=\"Title (only shown on some containers)\" /><br /><label>Container:</label><textarea rows=\"4\" class=\"form-control container-html\" name=\"container\" placeholder=\"Drag and drop a container or enter HTML here.\"></textarea>";
							}
						}

						res.json(200, {
							areas: data.areas,
							widgets: data.widgets
						});
					});
				});
			});

			app.get('/testing/categories', function (req, res) {
				res.json(200, {});
			});

			app.get('/groups', function (req, res) {
				async.parallel([
					function(next) {
						groups.list({
							expand: true
						}, next);
					},
					function(next) {
						groups.listSystemGroups({
							expand: true
						}, next);
					}
				], function(err, data) {
					var	groups = data[0].concat(data[1]);

					res.json(200, {
						groups: groups,
						yourid: req.user.uid
					});
				});
			});
		});
	};


}(exports));
