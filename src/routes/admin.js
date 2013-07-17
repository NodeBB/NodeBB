
var user = require('./../user.js'),
	topics = require('./../topics.js'),
	RDB = require('./../redis.js'),
	pkg = require('./../../package.json'),
	categories = require('./../categories.js');

(function(Admin) {
	Admin.isAdmin = function(req, res, next) {
		user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function(isAdmin) {
			if (!isAdmin) res.redirect('/403');
			else next();
		});
	}

	Admin.build_header = function(res) {
		return templates['admin/header'].parse({
			cssSrc: global.config['theme:src'] || global.nconf.get('relative_path') + '/vendor/bootstrap/css/bootstrap.min.css',
			csrf:res.locals.csrf_token,
			relative_path: global.nconf.get('relative_path')
		});
	}

	Admin.create_routes = function(app) {

		(function() {
			var routes = ['categories', 'users', 'topics', 'settings', 'themes', 'twitter', 'facebook', 'gplus', 'redis', 'motd'];

			for (var i=0, ii=routes.length; i<ii; i++) {
				(function(route) {
					app.get('/admin/' + route, Admin.isAdmin, function(req, res) {
						res.send(Admin.build_header(res) + app.create_route('admin/' + route) + templates['admin/footer']);
					});
				}(routes[i]));
			}

			var unit_tests = ['categories'];

			for (var i=0, ii=unit_tests.length; i<ii; i++) {
				(function(route) {
					app.get('/admin/testing/' + route, Admin.isAdmin, function(req, res) {
						res.send(Admin.build_header(res) + app.create_route('admin/testing/' + route) + templates['admin/footer']);
					});
				}(unit_tests[i]));
			}

		}());

		//todo consolidate.
		app.get('/admin', Admin.isAdmin, function(req, res) {
			res.send(Admin.build_header(res) + app.create_route('admin/index') + templates['admin/footer']);
		});
		
		app.get('/admin/index', Admin.isAdmin, function(req, res) {
			res.send(Admin.build_header(res) + app.create_route('admin/index') + templates['admin/footer']);
		});


		function api_method(req, res) {
			switch(req.params.method) {
				case 'index':
					res.json({version:pkg.version});
				break;
				case 'users' :
					if (req.params.tab == 'search') {
						res.json({search_display: 'block', users: []});
					} 
					else if(req.params.tab == 'latest') {
						user.getUserList(function(data) {
							data = data.sort(function(a, b) {
								return b.joindate - a.joindate;
							});
							res.json({search_display: 'none', users:data, yourid:req.user.uid});
						});
					}
					else if(req.params.tab == 'sort-posts') {
						user.getUserList(function(data) {
							data = data.sort(function(a, b) {
								return b.postcount - a.postcount;
							});
							res.json({search_display: 'none', users:data, yourid:req.user.uid});
						});
					}
					else if(req.params.tab == 'sort-reputation') {
						user.getUserList(function(data) {
							data = data.sort(function(a, b) {
								return b.reputation - a.reputation;
							});
							res.json({search_display: 'none', users:data, yourid:req.user.uid});
						});
					}
					else {
						user.getUserList(function(data) {
							res.json({search_display: 'none', users:data, yourid:req.user.uid});
						});
					}
					
					break;
				case 'categories':
					if (req.params.tab == 'disabled') {
						res.json({categories: []});
					} else {
						categories.getAllCategories(function(data) {
							res.json(data);
						});
					}
					break;
				case 'topics':
					topics.getAllTopics(10, null, function(topics) {
						res.json({
							topics: topics
						});
					});
					break;
				case 'redis':
					RDB.info(function(err, data) {
						data = data.split("\r\n");
						var finalData = {};

						for(var i in data) {
							
							try	{
								data[i] = data[i].replace(/:/,"\":\"");
								var json = "{\"" + data[i] + "\"}";
								
								var jsonObject = JSON.parse(json);
								for(var key in jsonObject) {
									finalData[key] = jsonObject[key];
								}
							}catch(err){

							}
						}

						
						res.json(finalData);
					});
					break;
				default :
					res.json({});
			}
		}

		app.get('/api/admin/:method/:tab?*', api_method);
		app.get('/api/admin/:method*', api_method);


	

	};


}(exports));