'use strict';

var winston = require('winston'),
	nconf = require('nconf'),
	fs = require('fs'),
	path = require('path'),
	less = require('less'),
	crypto = require('crypto'),
	async = require('async'),
	autoprefixer = require('autoprefixer'),
	postcss = require('postcss'),

	plugins = require('../plugins'),
	emitter = require('../emitter'),
	db = require('../database'),
	file = require('../file'),
	utils = require('../../public/src/utils');

module.exports = function(Meta) {

	Meta.css = {};
	Meta.css.cache = undefined;
	Meta.css.acpCache = undefined;

	Meta.css.minify = function(callback) {
		callback = callback || function() {};
		if (nconf.get('isPrimary') !== 'true') {
			winston.verbose('[meta/css] Cluster worker ' + process.pid + ' skipping LESS/CSS compilation');
			return callback();
		}

		winston.verbose('[meta/css] Minifying LESS/CSS');
		db.getObjectFields('config', ['theme:type', 'theme:id'], function(err, themeData) {
			if (err) {
				return callback(err);
			}

			var themeId = (themeData['theme:id'] || 'nodebb-theme-persona'),
				baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla')),
				paths = [
					baseThemePath,
					path.join(__dirname, '../../node_modules'),
					path.join(__dirname, '../../public/vendor/fontawesome/less'),
					path.join(__dirname, '../../public/vendor/bootstrap/less')
				],
				source = '@import "font-awesome";';

			plugins.lessFiles = filterMissingFiles(plugins.lessFiles);
			plugins.cssFiles = filterMissingFiles(plugins.cssFiles);

			async.waterfall([
				function(next) {
					getStyleSource(plugins.lessFiles, '\n@import ".', '.less', next);
				},
				function(src, next) {
					source += src;
					getStyleSource(plugins.cssFiles, '\n@import (inline) ".', '.css', next);
				},
				function(src, next) {
					source += src;
					next();
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/css/smoothness/jquery-ui-1.10.4.custom.min.css";';
				source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";';
				source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/textcomplete/jquery.textcomplete.css";';
				source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/colorpicker/colorpicker.css";';
				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/less/flags.less";';
				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/less/generics.less";';
				source += '\n@import "..' + path.sep + '..' + path.sep + 'public/less/mixins.less";';

				var acpSource = '\n@import "..' + path.sep + 'public/less/admin/admin";\n' + source;
				acpSource += '\n@import "..' + path.sep + 'public/less/generics.less";';
				acpSource += '\n@import (inline) "..' + path.sep + 'public/vendor/colorpicker/colorpicker.css";';

				source = '@import "./theme";\n' + source;

				async.parallel([
					function(next) {
						minify(source, paths, 'cache', next);
					},
					function(next) {
						minify(acpSource, paths, 'acpCache', next);
					}
				], function(err, minified) {
					if (err) {
						return callback(err);
					}

					// Propagate to other workers
					if (process.send) {
						process.send({
							action: 'css-propagate',
							cache: minified[0],
							acpCache: minified[1]
						});
					}

					emitter.emit('meta:css.compiled');

					callback();
				});
			});
		});
	};

	function getStyleSource(files, prefix, extension, callback) {
		var	pluginDirectories = [],
			source = '';

		files.forEach(function(styleFile) {
			if (styleFile.endsWith(extension)) {
				source += prefix + path.sep + styleFile + '";';
			} else {
				pluginDirectories.push(styleFile);
			}
		});

		async.each(pluginDirectories, function(directory, next) {
			utils.walk(directory, function(err, styleFiles) {
				if (err) {
					return next(err);
				}

				styleFiles.forEach(function(styleFile) {
					source += prefix + path.sep + styleFile + '";';
				});

				next();
			});
		}, function(err) {
			callback(err, source);
		});
	}

	Meta.css.commitToFile = function(filename) {
		var file = (filename === 'acpCache' ? 'admin' : 'stylesheet') + '.css';

		fs.writeFile(path.join(__dirname, '../../public/' + file), Meta.css[filename], function(err) {
			if (!err) {
				winston.verbose('[meta/css] ' + file + ' committed to disk.');
			} else {
				winston.error('[meta/css] ' + err.message);
				process.exit(0);
			}
		});
	};

	Meta.css.getFromFile = function(callback) {
		var cachePath = path.join(__dirname, '../../public/stylesheet.css'),
			acpCachePath = path.join(__dirname, '../../public/admin.css');
		file.exists(cachePath, function(exists) {
			if (!exists) {
				winston.warn('[meta/css] No stylesheets found on disk, re-minifying');
				Meta.css.minify(callback);
				return;
			}

			if (nconf.get('isPrimary') !== 'true') {
				return callback();
			}

			winston.verbose('[meta/css] Reading stylesheets from file');
			async.map([cachePath, acpCachePath], fs.readFile, function(err, files) {
				Meta.css.cache = files[0];
				Meta.css.acpCache = files[1];

				emitter.emit('meta:css.compiled');
				callback();
			});
		});
	};

	function minify(source, paths, destination, callback) {
		less.render(source, {
			paths: paths,
			compress: true
		}, function(err, lessOutput) {
			if (err) {
				winston.error('[meta/css] Could not minify LESS/CSS: ' + err.message);
				if (typeof callback === 'function') {
					callback(err);
				}
				return;
			}

			winston.verbose('[meta/css] Running PostCSS Plugins');
			postcss([ autoprefixer ]).process(lessOutput.css).then(function (result) {
				result.warnings().forEach(function (warn) {
					winston.verbose(warn.toString());
				});

				Meta.css[destination] = result.css;

				// Save the compiled CSS in public/ so things like nginx can serve it
				if (nconf.get('isPrimary') === 'true') {
					Meta.css.commitToFile(destination);
				}

				if (typeof callback === 'function') {
					callback(null, result.css);
				}
			});

		});
	}

	function filterMissingFiles(files) {
		return files.filter(function(filePath) {
			var exists = file.existsSync(path.join(__dirname, '../../node_modules', filePath));
			if (!exists) {
				winston.warn('[meta/css] File not found! ' + filePath);
			}
			return exists;
		});
	}
};