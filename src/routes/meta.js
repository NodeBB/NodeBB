var path = require('path'),
	nconf = require('nconf'),
	less = require('less'),

	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins');

(function (Meta) {
	Meta.createRoutes = function(app) {
		app.get('/stylesheet.css', function(req, res) {
			if (meta.css.cache) {
				res.type('text/css').send(200, meta.css.cache);
				return;
			}

			db.getObjectFields('config', ['theme:type', 'theme:id'], function(err, themeData) {
				var themeId = (themeData['theme:id'] || 'nodebb-theme-vanilla'),
					baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla')),
					paths = [baseThemePath, path.join(__dirname, '../../node_modules')],
					source = '@import "./theme";',
					x, numLESS;

				// Add the imports for each LESS file
				for(x=0,numLESS=plugins.lessFiles.length;x<numLESS;x++) {
					source += '\n@import "./' + plugins.lessFiles[x] + '";';
				}

				var	parser = new (less.Parser)({
						paths: paths
					});

				parser.parse(source, function(err, tree) {
					if (err) {
						res.send(500, err.message);
						return;
					}

					meta.css.cache = tree.toCSS({
						compress: true
					});
					res.type('text/css').send(200, meta.css.cache);
				});
			});
		});

		app.get('/nodebb.min.js', function(req, res) {
			var	sendCached = function() {
				return res.type('text/javascript').send(meta.js.cache);
			}
			if (meta.js.cache) {
				sendCached();
			} else {
				if (app.enabled('minification')) {
					meta.js.minify(function() {
						sendCached();
					});
				} else {
					// Compress only
					meta.js.concatenate(function() {
						sendCached();
					});
				}
			}
		});
	};
})(exports);