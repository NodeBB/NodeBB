var	nconf = require('nconf'),
	path = require('path'),
	fs = require('fs'),
	Plugins = require('../plugins'),

	PluginRoutes = function(app) {
		// Static Assets
		app.get('/plugins/:id/*', function(req, res) {
			var	relPath = req.url.replace('/plugins/' + req.params.id, '');
			if (Plugins.staticDirs[req.params.id]) {
				var	fullPath = path.join(Plugins.staticDirs[req.params.id], relPath);
				fs.exists(fullPath, function(exists) {
					if (exists) {
						res.sendfile(fullPath);
					} else {
						res.redirect('/404');
					}
				})
			} else {
				res.redirect('/404');
			}
		});
	};

module.exports = PluginRoutes;