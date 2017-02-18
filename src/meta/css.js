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

	var buildImports = {
		client: function (source) {
			return '@import "./theme";\n' + source + '\n' + [
				'@import "font-awesome";',
				'@import (inline) "../public/vendor/jquery/css/smoothness/jquery-ui.css";',
				'@import (inline) "../public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";',
				'@import (inline) "../public/vendor/colorpicker/colorpicker.css";',
				'@import (inline) "../node_modules/cropperjs/dist/cropper.css";',
				'@import "../../public/less/flags.less";',
				'@import "../../public/less/blacklist.less";',
				'@import "../../public/less/generics.less";',
				'@import "../../public/less/mixins.less";',
				'@import "../../public/less/global.less";',
			].map(function (str) { return str.replace(/\//g, path.sep); }).join('\n');
		},
		admin: function (source) {
			return source + '\n' + [
				'@import "font-awesome";',
				'@import "../public/less/admin/admin";',
				'@import "../public/less/generics.less";',
				'@import (inline) "../public/vendor/colorpicker/colorpicker.css";',
				'@import (inline) "../public/vendor/jquery/css/smoothness/jquery-ui.css";',
				'@import (inline) "../public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";',
			].map(function (str) { return str.replace(/\//g, path.sep); }).join('\n');
		},
	};

	Meta.css.minify = function (target, callback) {
		callback = callback || function () {};

		winston.verbose('[meta/css] Minifying LESS/CSS');
		db.getObjectFields('config', ['theme:type', 'theme:id'], function (err, themeData) {
			if (err) {
				return callback(err);
			}

			var themeId = (themeData['theme:id'] || 'nodebb-theme-persona');
			var baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla'));
			var paths = [
				baseThemePath,
				path.join(__dirname, '../../node_modules'),
				path.join(__dirname, '../../public/vendor/fontawesome/less'),
			];
			var source = '';

			var lessFiles = filterMissingFiles(plugins.lessFiles);
			var cssFiles = filterMissingFiles(plugins.cssFiles);

			async.waterfall([
				function (next) {
					getStyleSource(cssFiles, '\n@import (inline) ".', '.css', next);
				},
				function (src, next) {
					source += src;
					getStyleSource(lessFiles, '\n@import ".', '.less', next);
				},
				function (src, next) {
					source += src;
					next();
				},
			], function (err) {
				if (err) {
					return callback(err);
				}

				minify(buildImports[target](source), paths, target, callback);
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

	Meta.css.commitToFile = function (target, source, callback) {
		var filename = (target === 'client' ? 'stylesheet' : 'admin') + '.css';

		fs.writeFile(path.join(__dirname, '../../build/public/' + filename), source, function (err) {
			if (!err) {
				winston.verbose('[meta/css] ' + target + ' CSS committed to disk.');
			} else {
				winston.error('[meta/css] ' + err.message);
				process.exit(1);
			}

			callback();
		});
	};

	function minify(source, paths, target, callback) {
		callback = callback || function () {};
		less.render(source, {
			paths: paths,
		}, function (err, lessOutput) {
			if (err) {
				winston.error('[meta/css] Could not minify LESS/CSS: ' + err.message);
				return callback(err);
			}

			postcss(global.env === 'development' ? [ autoprefixer ] : [
				autoprefixer,
				clean({
					processImportFrom: ['local'],
				}),
			]).process(lessOutput.css).then(function (result) {
				result.warnings().forEach(function (warn) {
					winston.verbose(warn.toString());
				});

				return Meta.css.commitToFile(target, result.css, function () {
					callback(null, result.css);
				});
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
