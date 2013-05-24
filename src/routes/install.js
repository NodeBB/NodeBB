
var RDB = require('../redis.js');

(function(Install) {
	Install.create_routes = function(app) {

		(function() {
			var routes = ['basic'];

			for (var i=0, ii=routes.length; i<ii; i++) {
				(function(route) {
					app.get('/install/' + route, function(req, res) {
						res.send(templates['install/header'] + app.create_route('install/' + route) + templates['install/footer']);
					});
				}(routes[i]));
			}
		}());

		//todo consolidate.
		app.get('/install', function(req, res) {
			res.send(templates['install/header'] + app.create_route('install/basic') + templates['install/footer']);
		});
		app.get('/install/index', function(req, res) {
			res.send(templates['install/header'] + app.create_route('install/index') + templates['install/footer']);
		});


		function api_method(req, res) {
			switch(req.params.method) {
				case 'basic' :
					res.send('{}');
					break;

				default :
					res.send('{}');
			}
		}

		app.get('/api/install/:method/:tab?*', api_method);
		app.get('/api/install/:method*', api_method);
	};


}(exports));