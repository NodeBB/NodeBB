'use strict';

var winston = require('winston'),
	nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	less = require('less'),
	crypto = require('crypto'),

	plugins = require('../plugins'),
	emitter = require('../emitter'),
	db = require('../database');

module.exports = function(Meta) {

	Meta.css = {
		'css-buster': +new Date()
	};
	Meta.css.cache = undefined;
	Meta.css.branding = {};
	Meta.css.defaultBranding = {};

	Meta.css.minify = function() {
		winston.info('[meta/css] Minifying LESS/CSS');
		db.getObjectFields('config', ['theme:type', 'theme:id'], function(err, themeData) {
			var themeId = (themeData['theme:id'] || 'nodebb-theme-vanilla'),
				baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla')),
				paths = [
					baseThemePath,
					path.join(__dirname, '../../node_modules'),
					path.join(__dirname, '../../public/vendor/fontawesome/less')
				],
				source = '@import "./theme";\n@import "font-awesome";',
				x;


			plugins.lessFiles = filterMissingFiles(plugins.lessFiles);
			for(x=0; x<plugins.lessFiles.length; ++x) {
				source += '\n@import ".' + path.sep + plugins.lessFiles[x] + '";';
			}

			plugins.cssFiles = filterMissingFiles(plugins.cssFiles);
			for(x=0; x<plugins.cssFiles.length; ++x) {
				source += '\n@import (inline) ".' + path.sep + plugins.cssFiles[x] + '";';
			}

			source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/css/smoothness/jquery-ui-1.10.4.custom.min.css";';
			source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";';

			var	parser = new (less.Parser)({
					paths: paths
				});

			parser.parse(source, function(err, tree) {
				if (err) {
					winston.error('[meta/css] Could not minify LESS/CSS: ' + err.message);
					return;
				}

				try {
					var css = tree.toCSS({
						cleancss: true
					});
				} catch (err) {
					winston.error('[meta/css] Syntax Error: ' + err.message + ' - ' + path.basename(err.filename) + ' on line ' + err.line);
					return;
				}


				Meta.css.cache = css;

				// Calculate css buster
				var hasher = crypto.createHash('md5'),
					hash;
				hasher.update(css, 'utf-8');
				hash = hasher.digest('hex').slice(0, 8);
				Meta.css.hash = hash;

				var re = /.brand-([\S]*?)[ ]*?{[\s\S]*?color:([\S\s]*?)}/gi,
					match = re.exec(css);

				while (match && match.length > 1) {
					Meta.css.branding[match[1]] = match[2];
					match = re.exec(css);
				}

				Meta.css.defaultBranding = Meta.css.branding;
				Meta.css.updateBranding();

				winston.info('[meta/css] Done.');
				emitter.emit('meta:css.compiled');
			});
		});
	};

	function filterMissingFiles(files) {
		return files.filter(function(file) {
			var exists = fs.existsSync(path.join(__dirname, '../../node_modules', file));
			if (!exists) {
				winston.warn('[meta/css] File not found! ' + file);
			}
			return exists;
		});
	}

	Meta.css.updateBranding = function() {
		var Settings = require('../settings');
		var branding = new Settings('branding', '0', {}, function() {
			branding = branding.cfg._;

			for (var b in branding) {
				if (branding.hasOwnProperty(b)) {
					Meta.css.cache = Meta.css.cache.replace(new RegExp(Meta.css.branding[b], 'g'), branding[b]);
				}
			}

			Meta.css.branding = branding;
		});
	};
};