'use strict';

var winston = require('winston');
var nconf = require('nconf');
var fs = require('fs');
var path = require('path');
var less = require('less');
var async = require('async');
var autoprefixer = require('autoprefixer');
var postcss = require('postcss');
var clean = require('postcss-clean');

var plugins = require('../plugins');
var db = require('../database');
var file = require('../file');
var utils = require('../../public/src/utils');

module.exports = function (Meta) {

	Meta.css = {};
	Meta.css.cache = undefined;
	Meta.css.acpCache = undefined;

	Meta.css.minify = function (target, callback) {
		callback = callback || function () {};

		winston.verbose('[meta/css] Minifying LESS/CSS');
		db.getObjectFields('config', ['theme:type', 'theme:id'], function (err, themeData) {
			if (err) {
				return callback(err);
			}

			var themeId = (themeData['theme:id'] || 'nodebb-theme-persona'),
				baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla')),
				paths = [
					baseThemePath,
					path.join(__dirname, '../../node_modules'),
					path.join(__dirname, '../../public/vendor/fontawesome/less')
				],
				source = '@import "font-awesome";';

			plugins.lessFiles = filterMissingFiles(plugins.lessFiles);
			plugins.cssFiles = filterMissingFiles(plugins.cssFiles);

			async.waterfall([
				function (next) {
					getStyleSource(plugins.cssFiles, '\n@import (inline) ".', '.css', next);
				},
				function (src, next) {
					source += src;
					getStyleSource(plugins.lessFiles, '\n@import ".', '.less', next);
				},
				function (src, next) {
					source += src;
					next();
				}
			], function (err) {
				if (err) {
					return callback(err);
				}

				var acpSource = source;

				if (target !== 'admin.css') {
					source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/css/smoothness/jquery-ui.css";';
					source += '\n@import (inline) "..' + path.sep + '..' + path.sep + 'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";';
					source += '\n@import (inline) "..' + path.sep + 'public/vendor/colorpicker/colorpicker.css";';
					source += '\n@import "..' + path.sep + '..' + path.sep + 'public/less/flags.less";';
					source += '\n@import "..' + path.sep + '..' + path.sep + 'public/less/blacklist.less";';
					source += '\n@import "..' + path.sep + '..' + path.sep + 'public/less/generics.less";';
					source += '\n@import "..' + path.sep + '..' + path.sep + 'public/less/mixins.less";';
					source += '\n@import "..' + path.sep + '..' + path.sep + 'public/less/global.less";';
					source = '@import "./theme";\n' + source;

					minify(source, paths, 'cache', callback);
				} else {
					acpSource += '\n@import "..' + path.sep + 'public/less/admin/admin";\n';
					acpSource += '\n@import "..' + path.sep + 'public/less/generics.less";\n';
					acpSource += '\n@import (inline) "..' + path.sep + 'public/vendor/colorpicker/colorpicker.css";\n';
					acpSource += '\n@import (inline) "..' + path.sep + 'public/vendor/jquery/css/smoothness/jquery-ui.css";';
					acpSource += '\n@import (inline) "..' + path.sep + 'public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";';

					minify(acpSource, paths, 'acpCache', callback);
				}
			});
		});
	};

	function getStyleSource(files, prefix, extension, callback) {
		var	pluginDirectories = [],
			source = '';

		files.forEach(function (styleFile) {
			if (styleFile.endsWith(extension)) {
				source += prefix + path.sep + styleFile + '";';
			} else {
				pluginDirectories.push(styleFile);
			}
		});

		async.each(pluginDirectories, function (directory, next) {
			utils.walk(directory, function (err, styleFiles) {
				if (err) {
					return next(err);
				}

				styleFiles.forEach(function (styleFile) {
					source += prefix + path.sep + styleFile + '";';
				});

				next();
			});
		}, function (err) {
			callback(err, source);
		});
	}

	Meta.css.commitToFile = function (filename, callback) {
		var file = (filename === 'acpCache' ? 'admin' : 'stylesheet') + '.css';

		fs.writeFile(path.join(__dirname, '../../build/public/' + file), Meta.css[filename], function (err) {
			if (!err) {
				winston.verbose('[meta/css] ' + file + ' committed to disk.');
			} else {
				winston.error('[meta/css] ' + err.message);
				process.exit(0);
			}

			callback();
		});
	};

	function minify(source, paths, destination, callback) {
		callback = callback || function () {};
		less.render(source, {
			paths: paths
		}, function (err, lessOutput) {
			if (err) {
				winston.error('[meta/css] Could not minify LESS/CSS: ' + err.message);
				return callback(err);
			}

			postcss([ autoprefixer, clean() ]).process(lessOutput.css).then(function (result) {
				result.warnings().forEach(function (warn) {
					winston.verbose(warn.toString());
				});
				Meta.css[destination] = result.css;

				// Save the compiled CSS in public/ so things like nginx can serve it
				if (nconf.get('local-assets') === undefined || nconf.get('local-assets') !== false) {
					return Meta.css.commitToFile(destination, function () {
						callback(null, result.css);
					});
				}

				callback(null, result.css);
			});
		});
	}

	function filterMissingFiles(files) {
		return files.filter(function (filePath) {
			var exists = file.existsSync(path.join(__dirname, '../../node_modules', filePath));
			if (!exists) {
				winston.warn('[meta/css] File not found! ' + filePath);
			}
			return exists;
		});
	}
};
