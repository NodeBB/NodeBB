'use strict';

var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var winston = require('winston');
var async = require('async');
var path = require('path');
var fs = require('fs');
var nconf = require('nconf');

var plugins = require('../plugins');
var file = require('../file');

var viewsPath = nconf.get('views_dir');

var Templates = module.exports;

Templates.compile = function (callback) {
	callback = callback || function () {};

	var themeConfig = require(nconf.get('theme_config'));
	var baseTemplatesPaths = themeConfig.baseTheme ? getBaseTemplates(themeConfig.baseTheme) : [nconf.get('base_templates_path')];

	function processImports(paths, relativePath, source, callback) {
		var regex = /<!-- IMPORT (.+?) -->/;

		var matches = source.match(regex);

		if (!matches) {
			return callback(null, source);
		}

		var partial = '/' + matches[1];
		if (paths[partial] && relativePath !== partial) {
			fs.readFile(paths[partial], 'utf8', function (err, partialSource) {
				if (err) {
					return callback(err);
				}

				source = source.replace(regex, partialSource);

				processImports(paths, relativePath, source, callback);
			});
		} else {
			winston.warn('[meta/templates] Partial not loaded: ' + matches[1]);
			source = source.replace(regex, '');

			processImports(paths, relativePath, source, callback);
		}
	}

	async.waterfall([
		function (next) {
			preparePaths(baseTemplatesPaths, next);
		},
		function (paths, next) {
			async.each(Object.keys(paths), function (relativePath, next) {
				async.waterfall([
					function (next) {
						fs.readFile(paths[relativePath], 'utf8', next);
					},
					function (source, next) {
						processImports(paths, relativePath, source, next);
					},
					function (source, next) {
						mkdirp(path.join(viewsPath, path.dirname(relativePath)), function (err) {
							next(err, source);
						});
					},
					function (compiled, next) {
						fs.writeFile(path.join(viewsPath, relativePath), compiled, next);
					},
				], next);
			}, next);
		},
		function (next) {
			rimraf(path.join(viewsPath, '*.js'), next);
		},
		function (next) {
			winston.verbose('[meta/templates] Successfully compiled templates.');
			next();
		},
	], callback);
};

function getBaseTemplates(theme) {
	var baseTemplatesPaths = [];
	var baseThemePath;
	var baseThemeConfig;

	while (theme) {
		baseThemePath = path.join(nconf.get('themes_path'), theme);
		baseThemeConfig = require(path.join(baseThemePath, 'theme.json'));

		baseTemplatesPaths.push(path.join(baseThemePath, baseThemeConfig.templates || 'templates'));
		theme = baseThemeConfig.baseTheme;
	}

	return baseTemplatesPaths.reverse();
}

function preparePaths(baseTemplatesPaths, callback) {
	var coreTemplatesPath = nconf.get('core_templates_path');
	var pluginTemplates;
	async.waterfall([
		function (next) {
			rimraf(viewsPath, next);
		},
		function (next) {
			mkdirp(viewsPath, next);
		},
		function (viewsPath, next) {
			plugins.fireHook('static:templates.precompile', {}, next);
		},
		function (next) {
			plugins.getTemplates(next);
		},
		function (_pluginTemplates, next) {
			pluginTemplates = _pluginTemplates;
			winston.verbose('[meta/templates] Compiling templates');

			async.parallel({
				coreTpls: function (next) {
					file.walk(coreTemplatesPath, next);
				},
				baseThemes: function (next) {
					async.map(baseTemplatesPaths, function (baseTemplatePath, next) {
						file.walk(baseTemplatePath, function (err, paths) {
							paths = paths.map(function (tpl) {
								return {
									base: baseTemplatePath,
									path: tpl.replace(baseTemplatePath, ''),
								};
							});

							next(err, paths);
						});
					}, next);
				},
			}, next);
		},
		function (data, next) {
			var baseThemes = data.baseThemes;
			var coreTpls = data.coreTpls;
			var paths = {};

			coreTpls.forEach(function (el, i) {
				paths[coreTpls[i].replace(coreTemplatesPath, '')] = coreTpls[i];
			});

			baseThemes.forEach(function (baseTpls) {
				baseTpls.forEach(function (el, i) {
					paths[baseTpls[i].path] = path.join(baseTpls[i].base, baseTpls[i].path);
				});
			});

			for (var tpl in pluginTemplates) {
				if (pluginTemplates.hasOwnProperty(tpl)) {
					paths[tpl] = pluginTemplates[tpl];
				}
			}

			next(null, paths);
		},
	], callback);
}
