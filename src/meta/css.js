'use strict';

var winston = require('winston');
var nconf = require('nconf');
var fs = require('fs');
var path = require('path');
var async = require('async');

var plugins = require('../plugins');
var db = require('../database');
var file = require('../file');
var minifier = require('./minifier');

var CSS = module.exports;

var buildImports = {
	client: function (source) {
		return '@import "./theme";\n' + source + '\n' + [
			'@import "font-awesome";',
			'@import (inline) "../public/vendor/jquery/css/smoothness/jquery-ui.css";',
			'@import (inline) "../public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";',
			'@import (inline) "../public/vendor/colorpicker/colorpicker.css";',
			'@import (inline) "../node_modules/cropperjs/dist/cropper.css";',
			'@import "../../public/less/flags.less";',
			'@import "../../public/less/admin/manage/ip-blacklist.less";',
			'@import "../../public/less/generics.less";',
			'@import "../../public/less/mixins.less";',
			'@import "../../public/less/global.less";',
		].map(function (str) {
			return str.replace(/\//g, path.sep);
		}).join('\n');
	},
	admin: function (source) {
		return source + '\n' + [
			'@import "font-awesome";',
			'@import "../public/less/admin/admin";',
			'@import "../public/less/generics.less";',
			'@import (inline) "../public/vendor/colorpicker/colorpicker.css";',
			'@import (inline) "../public/vendor/jquery/css/smoothness/jquery-ui.css";',
			'@import (inline) "../public/vendor/jquery/bootstrap-tagsinput/bootstrap-tagsinput.css";',
			'@import (inline) "../public/vendor/mdl/material.css";',
		].map(function (str) {
			return str.replace(/\//g, path.sep);
		}).join('\n');
	},
};

function filterMissingFiles(filepaths, callback) {
	async.filter(filepaths, function (filepath, next) {
		file.exists(path.join(__dirname, '../../node_modules', filepath), function (err, exists) {
			if (!exists) {
				winston.warn('[meta/css] File not found! ' + filepath);
			}

			next(err, exists);
		});
	}, callback);
}

function getImports(files, prefix, extension, callback) {
	var pluginDirectories = [];
	var source = '';

	files.forEach(function (styleFile) {
		if (styleFile.endsWith(extension)) {
			source += prefix + path.sep + styleFile + '";';
		} else {
			pluginDirectories.push(styleFile);
		}
	});

	async.each(pluginDirectories, function (directory, next) {
		file.walk(directory, function (err, styleFiles) {
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

function getBundleMetadata(target, callback) {
	var paths = [
		path.join(__dirname, '../../node_modules'),
		path.join(__dirname, '../../public/less'),
		path.join(__dirname, '../../public/vendor/fontawesome/less'),
	];

	async.waterfall([
		function (next) {
			if (target !== 'client') {
				return next(null, null);
			}

			db.getObjectFields('config', ['theme:type', 'theme:id'], next);
		},
		function (themeData, next) {
			if (target === 'client') {
				var themeId = (themeData['theme:id'] || 'nodebb-theme-persona');
				var baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla'));
				paths.unshift(baseThemePath);
			}

			async.parallel({
				less: function (cb) {
					async.waterfall([
						function (next) {
							filterMissingFiles(plugins.lessFiles, next);
						},
						function (lessFiles, next) {
							getImports(lessFiles, '\n@import ".', '.less', next);
						},
					], cb);
				},
				acpLess: function (cb) {
					if (target === 'client') {
						return cb(null, '');
					}

					async.waterfall([
						function (next) {
							filterMissingFiles(plugins.acpLessFiles, next);
						},
						function (acpLessFiles, next) {
							getImports(acpLessFiles, '\n@import ".', '.less', next);
						},
					], cb);
				},
				css: function (cb) {
					async.waterfall([
						function (next) {
							filterMissingFiles(plugins.cssFiles, next);
						},
						function (cssFiles, next) {
							getImports(cssFiles, '\n@import (inline) ".', '.css', next);
						},
					], cb);
				},
			}, next);
		},
		function (result, next) {
			var cssImports = result.css;
			var lessImports = result.less;
			var acpLessImports = result.acpLess;

			var imports = cssImports + '\n' + lessImports + '\n' + acpLessImports;
			imports = buildImports[target](imports);

			next(null, { paths: paths, imports: imports });
		},
	], callback);
}

CSS.buildBundle = function (target, fork, callback) {
	async.waterfall([
		function (next) {
			getBundleMetadata(target, next);
		},
		function (data, next) {
			var minify = global.env !== 'development';
			minifier.css.bundle(data.imports, data.paths, minify, fork, next);
		},
		function (bundle, next) {
			var filename = (target === 'client' ? 'stylesheet' : 'admin') + '.css';

			fs.writeFile(path.join(__dirname, '../../build/public', filename), bundle.code, next);
		},
	], callback);
};
