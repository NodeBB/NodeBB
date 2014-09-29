'use strict';

var winston = require('winston'),
	nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	less = require('less'),
	crypto = require('crypto'),
	async = require('async'),
	cluster = require('cluster'),

	plugins = require('../plugins'),
	emitter = require('../emitter'),
	db = require('../database');

module.exports = function(Meta) {

	Meta.css = {
		'css-buster': +new Date()
	};
	Meta.css.cache = undefined;
	Meta.css.acpCache = undefined;
	Meta.css.branding = {};
	Meta.css.defaultBranding = {};

	Meta.css.minify = function(callback) {
		if (!cluster.isWorker || process.env.cluster_setup === 'true') {
			winston.info('[meta/css] Minifying LESS/CSS');
			db.getObjectFields('config', ['theme:type', 'theme:id'], function(err, themeData) {
				var themeId = (themeData['theme:id'] || 'nodebb-theme-vanilla'),
					baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla')),
					paths = [
						baseThemePath,
						path.join(__dirname, '../../node_modules'),
						path.join(__dirname, '../../public/vendor/fontawesome/less'),
						path.join(__dirname, '../../public/vendor/bootstrap/less')
					],
					source = '@import "font-awesome";',
					acpSource,
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


				acpSource = '\n@import "..' + path.sep + 'public/less/admin/admin";\n' + source;
				source = '@import "./theme";\n' + source;

				async.parallel([
					function(next) {
						minify(source, paths, 'cache', next);
					},
					function(next) {
						minify(acpSource, paths, 'acpCache', next);
					}
				], function(err, minified) {
					// Propagate to other workers
					if (cluster.isWorker) {
						process.send({
							action: 'css-propagate',
							cache: minified[0],
							acpCache: minified[1]
						});
					}

					if (typeof callback === 'function') {
						callback();
					}
				});
			});
		} else {
			if (typeof callback === 'function') {
				callback();
			}
		}
	};

	Meta.css.commitToFile = function(filename) {
		winston.info('[meta/css] Committing stylesheet (' + filename + ') to disk');
		fs.writeFile(path.join(__dirname, '../../public/' + (filename === 'acpCache' ? 'admin' : 'stylesheet') + '.css'), Meta.css[filename], function(err) {
			if (!err) {
				winston.info('[meta/css] Stylesheet (' + filename + ') committed to disk.');
			} else {
				winston.error('[meta/css] ' + err.message);
				process.exit(0);
			}
		});
	}

	function minify(source, paths, destination, callback) {	
		var	parser = new (less.Parser)({
				paths: paths
			});

		parser.parse(source, function(err, tree) {
			if (err) {
				winston.error('[meta/css] Could not minify LESS/CSS: ' + err.message);
				if (typeof callback === 'function') {
					callback(err);
				}
				return;
			}

			try {
				var css = tree.toCSS({
					cleancss: true
				});
			} catch (err) {
				winston.error('[meta/css] Syntax Error: ' + err.message + ' - ' + path.basename(err.filename) + ' on line ' + err.line);
				if (typeof callback === 'function') {
					callback(err);
				}
				return;
			}

			Meta.css[destination] = css;

			// Calculate css buster
			var hasher = crypto.createHash('md5'),
				hash;
			hasher.update(css, 'utf-8');
			hash = hasher.digest('hex').slice(0, 8);
			Meta.css.hash = hash;

			winston.info('[meta/css] Done.');
			emitter.emit('meta:css.compiled');

			// Save the compiled CSS in public/ so things like nginx can serve it
			if (!cluster.isWorker || process.env.cluster_setup === 'true') {
				Meta.css.commitToFile(destination);
			}

			if (typeof callback === 'function') {
				callback(null, css);
			}
		});
	}

	function filterMissingFiles(files) {
		return files.filter(function(file) {
			var exists = fs.existsSync(path.join(__dirname, '../../node_modules', file));
			if (!exists) {
				winston.warn('[meta/css] File not found! ' + file);
			}
			return exists;
		});
	}
};