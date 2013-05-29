
var user = require('./../user.js'),
	topics = require('./../topics.js'),
	RDB = require('./../redis.js')
	categories = require('./../categories.js');

(function(Admin) {
	Admin.isAdmin = function(req, res, next) {
		user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function(isAdmin) {
			if (!isAdmin) res.redirect('/403');
			else next();
		});
	}

	Admin.create_routes = function(app) {

		(function() {
			var routes = ['categories', 'users', 'topics', 'settings', 'themes', 'twitter', 'facebook', 'gplus', 'redis'];

			for (var i=0, ii=routes.length; i<ii; i++) {
				(function(route) {
					app.get('/admin/' + route, Admin.isAdmin, function(req, res) {
						res.send(templates['admin/header'] + app.create_route('admin/' + route) + templates['admin/footer']);
					});
				}(routes[i]));
			}
		}());

		//todo consolidate.
		app.get('/admin', Admin.isAdmin, function(req, res) {
			res.send(templates['admin/header'] + app.create_route('admin/index') + templates['admin/footer']);
		});
		app.get('/admin/index', Admin.isAdmin, function(req, res) {
			res.send(templates['admin/header'] + app.create_route('admin/index') + templates['admin/footer']);
		});


		function api_method(req, res) {
			switch(req.params.method) {
				case 'users' :
					if (req.params.tab == 'search') {
						res.send(JSON.stringify({search_display: 'block', users: []}))
					} else {
						user.getUserList(function(data){
							res.send(JSON.stringify({search_display: 'none', users:data}));
						});
					}
					
					break;
				case 'categories':
					if (req.params.tab == 'disabled') {
						res.send(JSON.stringify({categories: []}));
					} else {
						categories.getAllCategories(function(data) {
							res.send(JSON.stringify(data));
						});
					}
					break;
				case 'topics' :
					categories.getCategoryById(0, 0, function(data) {
						res.send(JSON.stringify(data));
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

						
						res.send(JSON.stringify(finalData));
					});
					break;
				default :
					res.send('{}');
			}
		}

		app.get('/api/admin/:method/:tab?*', api_method);
		app.get('/api/admin/:method*', api_method);
	};


}(exports));