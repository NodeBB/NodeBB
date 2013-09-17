var user = require('./../user.js'),
	Groups = require('../groups'),
	topics = require('./../topics.js'),
	RDB = require('./../redis.js'),
	pkg = require('./../../package.json'),
	categories = require('./../categories.js'),
	plugins = require('../plugins'),
	winston = require('winston');

(function(Admin) {
	Admin.isAdmin = function(req, res, next) {
		user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function(isAdmin) {
			if (!isAdmin) res.redirect('/403');
			else next();
		});
	}

	Admin.build_header = function(res) {
		return templates['admin/header'].parse({
			csrf: res.locals.csrf_token,
			relative_path: nconf.get('relative_path')
		});
	}

	Admin.create_routes = function(app) {

		(function() {
			var routes = [
				'categories/active', 'categories/disabled', 'users', 'topics', 'settings', 'themes',
				'twitter', 'facebook', 'gplus', 'redis', 'motd', 'groups',
				'users/latest', 'users/sort-posts', 'users/sort-reputation',
				'users/search', 'plugins'
			];

			for (var i = 0, ii = routes.length; i < ii; i++) {
				(function(route) {
					app.get('/admin/' + route, Admin.isAdmin, function(req, res) {
						res.send(Admin.build_header(res) + app.create_route('admin/' + route) + templates['admin/footer']);
					});
				}(routes[i]));
			}

			var unit_tests = ['categories'];

			for (var i = 0, ii = unit_tests.length; i < ii; i++) {
				(function(route) {
					app.get('/admin/testing/' + route, Admin.isAdmin, function(req, res) {
						res.send(Admin.build_header(res) + app.create_route('admin/testing/' + route) + templates['admin/footer']);
					});
				}(unit_tests[i]));
			}

		}());

		app.get('/admin', Admin.isAdmin, function(req, res) {
			res.send(Admin.build_header(res) + app.create_route('admin/index') + templates['admin/footer']);
		});

		app.get('/admin/index', Admin.isAdmin, function(req, res) {
			res.send(Admin.build_header(res) + app.create_route('admin/index') + templates['admin/footer']);
		});

		app.get('/api/admin/index', function(req, res) {
			res.json({
				version: pkg.version
			});
		});

		app.get('/api/admin/users/search', function(req, res) {
			res.json({
				search_display: 'block',
				loadmore_display: 'none',
				users: []
			});
		});

		app.get('/api/admin/users/latest', function(req, res) {
			user.getUsers('users:joindate', 0, 49, function(err, data) {
				res.json({
					search_display: 'none',
					loadmore_display: 'block',
					users: data,
					yourid: req.user.uid
				});
			});
		});

		app.get('/api/admin/users/sort-posts', function(req, res) {
			user.getUsers('users:postcount', 0, 49, function(err, data) {
				res.json({
					search_display: 'none',
					loadmore_display: 'block',
					users: data,
					yourid: req.user.uid
				});
			});
		});

		app.get('/api/admin/users/sort-reputation', function(req, res) {
			user.getUsers('users:reputation', 0, 49, function(err, data) {
				res.json({
					search_display: 'none',
					loadmore_display: 'block',
					users: data,
					yourid: req.user.uid
				});
			});
		});

		app.get('/api/admin/users', function(req, res) {
			user.getUsers('users:joindate', 0, 49, function(err, data) {
				res.json({
					search_display: 'none',
					users: data,
					yourid: req.user.uid
				});
			});
		});

		app.get('/api/admin/categories', function(req, res) {
			categories.getAllCategories(function(data) {
				res.json(data);
			});
		});

		app.get('/api/admin/categories/active', function(req, res) {
			categories.getAllCategories(function(data) {
				data.categories = data.categories.filter(function(category) {
					return (!category.disabled || category.disabled === "0");
				});
				res.json(data);
			});
		});

		app.get('/api/admin/categories/disabled', function(req, res) {
			categories.getAllCategories(function(data) {
				data.categories = data.categories.filter(function(category) {
					return category.disabled === "1";
				});
				res.json(data);
			});
		});

		app.get('/api/admin/topics', function(req, res) {
			topics.getAllTopics(10, null, function(topics) {
				res.json({
					topics: topics
				});
			});
		});

		app.get('/api/admin/redis', function(req, res) {
			RDB.info(function(err, data) {
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

		app.get('/api/admin/plugins', function(req, res) {
			plugins.showInstalled(function(err, plugins) {
				if (err || !Array.isArray(plugins)) plugins = [];

				res.json(200, {
					plugins: plugins
				});
			});
		});

		app.get('/api/admin/settings', function(req, res) {
			res.json(200, {});
		});

		app.get('/api/admin/motd', function(req, res) {
			res.json(200, {});
		});

		app.get('/api/admin/themes', function(req, res) {
			res.json(200, {});
		});

		app.get('/api/admin/twitter', function(req, res) {
			res.json(200, {});
		});

		app.get('/api/admin/facebook', function(req, res) {
			res.json(200, {});
		});

		app.get('/api/admin/gplus', function(req, res) {
			res.json(200, {});
		});

		app.get('/api/admin/testing/categories', function(req, res) {
			res.json(200, {});
		});

		app.get('/api/admin/groups', function(req, res) {
			Groups.list({
				expand: true
			}, function(err, groups) {
				res.json(200, {
					groups: groups
				});
			});
		});
	};


}(exports));