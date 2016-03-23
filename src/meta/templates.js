"use strict";

var mkdirp = require('mkdirp'),
	rimraf = require('rimraf'),
	winston = require('winston'),
	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),

	emitter = require('../emitter'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),

	Templates = {},
	searchIndex = {};

Templates.compile = function(callback) {
	callback = callback || function() {};
	var fromFile = nconf.get('from-file') || '';

	if (nconf.get('isPrimary') === 'false' || fromFile.match('tpl')) {
		if (fromFile.match('tpl')) {
			emitter.emit('templates:compiled');
			winston.info('[minifier] Compiling templates skipped');
		}

		return callback();
	}

	compile(callback);
};


function getBaseTemplates(theme) {
	var baseTemplatesPaths = [],
		baseThemePath, baseThemeConfig;

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
	var viewsPath = nconf.get('views_dir');

	async.waterfall([
		function (next) {
			rimraf(viewsPath, next);
		},
		function (next) {
			mkdirp(viewsPath, next);
		},
		function(viewsPath, next) {
			plugins.fireHook('static:templates.precompile', {}, next);
		},
		function(next) {
			plugins.getTemplates(next);
		}
	], function(err, pluginTemplates) {
		if (err) {
			return callback(err);
		}

		winston.verbose('[meta/templates] Compiling templates');

		async.parallel({
			coreTpls: function(next) {
				utils.walk(coreTemplatesPath, next);
			},
			baseThemes: function(next) {
				async.map(baseTemplatesPaths, function(baseTemplatePath, next) {
					utils.walk(baseTemplatePath, function(err, paths) {
						paths = paths.map(function(tpl) {
							return {
								base: baseTemplatePath,
								path: tpl.replace(baseTemplatePath, '')
							};
						});

						next(err, paths);
					});
				}, next);
			}
		}, function(err, data) {
			var baseThemes = data.baseThemes,
				coreTpls = data.coreTpls,
				paths = {};

			coreTpls.forEach(function(el, i) {
				paths[coreTpls[i].replace(coreTemplatesPath, '')] = coreTpls[i];
			});

			baseThemes.forEach(function(baseTpls) {
				baseTpls.forEach(function(el, i) {
					paths[baseTpls[i].path] = path.join(baseTpls[i].base, baseTpls[i].path);
				});
			});

			for (var tpl in pluginTemplates) {
				if (pluginTemplates.hasOwnProperty(tpl)) {
					paths[tpl] = pluginTemplates[tpl];
				}
			}

			callback(err, paths);
		});
	});
}

function compile(callback) {
	var themeConfig = require(nconf.get('theme_config')),
		baseTemplatesPaths = themeConfig.baseTheme ? getBaseTemplates(themeConfig.baseTheme) : [nconf.get('base_templates_path')],
		viewsPath = nconf.get('views_dir');


	preparePaths(baseTemplatesPaths, function(err, paths) {
		if (err) {
			return callback(err);
		}

		async.each(Object.keys(paths), function(relativePath, next) {
			var file = fs.readFileSync(paths[relativePath]).toString(),
				matches = null,
				regex = /[ \t]*<!-- IMPORT ([\s\S]*?)? -->[ \t]*/;

			while((matches = file.match(regex)) !== null) {
				var partial = "/" + matches[1];

				if (paths[partial] && relativePath !== partial) {
					file = file.replace(regex, fs.readFileSync(paths[partial]).toString());
				} else {
					winston.warn('[meta/templates] Partial not loaded: ' + matches[1]);
					file = file.replace(regex, "");
				}
			}

			if (relativePath.match(/^\/admin\/[\s\S]*?/)) {
				addIndex(relativePath, file);
			}

			mkdirp.sync(path.join(viewsPath, relativePath.split('/').slice(0, -1).join('/')));
			fs.writeFile(path.join(viewsPath, relativePath), file, next);
		}, function(err) {
			if (err) {
				winston.error('[meta/templates] ' + err.stack);
				return callback(err);
			}

			compileIndex(viewsPath, function() {
				winston.verbose('[meta/templates] Successfully compiled templates.');

				emitter.emit('templates:compiled');
				if (process.send) {
					process.send({
						action: 'templates:compiled'
					});
				}
				callback();
			});
		});
	});
}


function addIndex(path, file) {
	searchIndex[path] = file;
}

function compileIndex(viewsPath, callback) {
	fs.writeFile(path.join(viewsPath, '/indexed.json'), JSON.stringify(searchIndex), callback);
}

module.exports = Templates;