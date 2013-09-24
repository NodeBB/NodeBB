var user = require('./../user.js'),
	Groups = require('../groups'),
	topics = require('./../topics.js'),
	RDB = require('./../redis.js'),
	pkg = require('./../../package.json'),
	categories = require('./../categories.js'),
	Meta = require('../meta'),
	plugins = require('../plugins'),
	winston = require('winston'),
	nconf = require('nconf'),
	fs = require('fs');

(function (Admin) {
	Admin.isAdmin = function (req, res, next) {
		user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function (isAdmin) {
			if (!isAdmin) res.redirect('/403');
			else next();
		});
	}

	Admin.build_header = function (res) {
		return templates['admin/header'].parse({
			csrf: res.locals.csrf_token,
			relative_path: nconf.get('relative_path')
		});
	}

	Admin.create_routes = function (app) {

		(function () {
			var routes = [
				'categories/active', 'categories/disabled', 'users', 'topics', 'settings', 'themes',
				'twitter', 'facebook', 'gplus', 'redis', 'motd', 'groups',
				'users/latest', 'users/sort-posts', 'users/sort-reputation',
				'users/search', 'plugins'
			];

			for (var i = 0, ii = routes.length; i < ii; i++) {
				(function (route) {
					app.get('/admin/' + route, Admin.isAdmin, function (req, res) {
						res.send(Admin.build_header(res) + app.create_route('admin/' + route) + templates['admin/footer']);
					});
				}(routes[i]));
			}

			var unit_tests = ['categories'];

			for (var i = 0, ii = unit_tests.length; i < ii; i++) {
				(function (route) {
					app.get('/admin/testing/' + route, Admin.isAdmin, function (req, res) {
						res.send(Admin.build_header(res) + app.create_route('admin/testing/' + route) + templates['admin/footer']);
					});
				}(unit_tests[i]));
			}

		}());

		app.namespace('/admin', function () {
			app.get('/', Admin.isAdmin, function (req, res) {
				res.send(Admin.build_header(res) + app.create_route('admin/index') + templates['admin/footer']);
			});

			app.get('/index', Admin.isAdmin, function (req, res) {
				res.send(Admin.build_header(res) + app.create_route('admin/index') + templates['admin/footer']);
			});
		});

		app.namespace('/api/admin', function () {
			app.get('/index', function (req, res) {
				res.json({
					version: pkg.version
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
				categories.getAllCategories(function (data) {
					res.json(data);
				});
			});

			app.get('/categories/active', function (req, res) {
				categories.getAllCategories(function (data) {
					data.categories = data.categories.filter(function (category) {
						return (!category.disabled || category.disabled === "0");
					});
					res.json(data);
				});
			});

			app.get('/categories/disabled', function (req, res) {
				categories.getAllCategories(function (data) {
					data.categories = data.categories.filter(function (category) {
						return category.disabled === "1";
					});
					res.json(data);
				});
			});

			app.get('/topics', function (req, res) {
				topics.getAllTopics(10, null, function (topics) {
					res.json({
						topics: topics
					});
				});
			});

			app.namespace('/redis', function () {
				app.get('/', function (req, res) {
					RDB.info(function (err, data) {
						data = data.split("\r\n");
						var finalData = {};

						for (var i in data) {

							if (data[i].indexOf(':') == -1 || !data[i])
								continue;

							try {
								data[i] = data[i].replace(/:/, "\":\"");
								var json = "{\"" + data[i] + "\"}";

								var jsonObject = JSON.parse(json);
								for (var key in jsonObject) {
									finalData[key] = jsonObject[key];
								}
							} catch (err) {
								winston.warn('can\'t parse redis status variable, ignoring', i, data[i], err);
							}
						}

						res.json(finalData);
					});
				});

				// app.get('/export', Admin.isAdmin, function (req, res) {
				// 	Meta.db.getFile(function (err, dbFile) {
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
				Groups.list({
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