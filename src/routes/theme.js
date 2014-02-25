var path = require('path'),
	nconf = require('nconf'),
	less = require('less'),

	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins');

(function (Meta) {
	Meta.createRoutes = function(app) {
		app.get('/stylesheet.css', function(req, res) {
			db.getObjectFields('config', ['theme:type', 'theme:id'], function(err, themeData) {
				var themeId = (themeData['theme:id'] || 'nodebb-theme-vanilla'),
					baseThemePath = path.join(nconf.get('themes_path'), themeId),
					paths = [baseThemePath, path.join(__dirname, '../../node_modules')],
					source = '@import "./theme";',
					x, numLESS;

				// Add the imports for each LESS file
				for(x=0,numLESS=plugins.lessFiles.length;x<numLESS;x++) {
					source += '\n@import "./' + plugins.lessFiles[x] + '";';
				}

				// Detect if a theme has been selected, and handle appropriately
				if (!themeData['theme:type'] || themeData['theme:type'] === 'local') {
					// Local theme
					var	parser = new (less.Parser)({
							paths: paths
						});

					parser.parse(source, function(err, tree) {
						if (err) {
							res.send(500, err.message);
							console.log(err);
							return;
						}

						res.type('text/css').send(200, tree.toCSS());
					});
				} else {
					// Bootswatch theme not supported yet
					res.send(500, 'Give me time!');
				}
			});
		});
	};
})(exports);