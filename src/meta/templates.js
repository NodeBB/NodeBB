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
	templatist = require('nodebb-templatist'),

	Templates = {};

require('nodebb-templatist-tpl')(templatist, nconf.get('views_dir'));

Templates.compile = function(callback) {
	var fromFile = nconf.get('from-file') || '';

	if (nconf.get('isPrimary') === 'false' || fromFile.match('tpl')) {
		if (fromFile.match('tpl')) {
			winston.info('[minifier] Compiling templates skipped');
		}

		emitter.emit('templates:compiled');
		if (callback) {
			callback();
		}
		return;
	}

	var coreTemplatesPath = nconf.get('core_templates_path'),
		baseTemplatesPath = nconf.get('base_templates_path'),
		viewsPath = nconf.get('views_dir'),
		themeTemplatesPath = nconf.get('theme_templates_path'),
		themeConfig = require(nconf.get('theme_config'));

	if (themeConfig.baseTheme) {
		var pathToBaseTheme = path.join(nconf.get('themes_path'), themeConfig.baseTheme);
		baseTemplatesPath = require(path.join(pathToBaseTheme, 'theme.json')).templates;

		if (!baseTemplatesPath){
			baseTemplatesPath = path.join(pathToBaseTheme, 'templates');
		}
	}

	plugins.getTemplates(function(err, pluginTemplates) {
		if (err) {
			return callback(err);
		}
		winston.verbose('[meta/templates] Compiling templates');
		rimraf.sync(viewsPath);
		mkdirp.sync(viewsPath);

		async.parallel({
			coreTpls: function(next) {
				utils.walk(coreTemplatesPath, next);
			},
			baseTpls: function(next) {
				utils.walk(baseTemplatesPath, next);
			},
			themeTpls: function(next) {
				utils.walk(themeTemplatesPath, next);
			}
		}, function(err, data) {
			var coreTpls = data.coreTpls,
				baseTpls = data.baseTpls,
				themeTpls = data.themeTpls,
				paths = {};

			if (!baseTpls || !themeTpls) {
				winston.warn('[meta/templates] Could not find base template files at: ' + baseTemplatesPath);
			}

			coreTpls = !coreTpls ? [] : coreTpls.map(function(tpl) { return tpl.replace(coreTemplatesPath, ''); });
			baseTpls = !baseTpls ? [] : baseTpls.map(function(tpl) { return tpl.replace(baseTemplatesPath, ''); });
			themeTpls = !themeTpls ? [] : themeTpls.map(function(tpl) { return tpl.replace(themeTemplatesPath, ''); });

			coreTpls.forEach(function(el, i) {
				paths[coreTpls[i]] = path.join(coreTemplatesPath, coreTpls[i]);
			});

			baseTpls.forEach(function(el, i) {
				paths[baseTpls[i]] = path.join(baseTemplatesPath, baseTpls[i]);
			});

			themeTpls.forEach(function(el, i) {
				paths[themeTpls[i]] = path.join(themeTemplatesPath, themeTpls[i]);
			});

			for (var tpl in pluginTemplates) {
				if (pluginTemplates.hasOwnProperty(tpl)) {
					paths[tpl] = pluginTemplates[tpl];
				}
			}

			async.each(Object.keys(paths), function(relativePath, next) {
				templatist.compile(paths, relativePath, viewsPath, function(err, data) {
					if (err) {
						next(err);
						return;
					}
					if (data.warnings && data.warnings.length) {
						for (var warn in data.warnings) {
							winston.warn('[meta/templates] ' + warn);
						}
					}
					async.each(Object.keys(data.files), function(compiledFilePath, next) {
						if (relativePath.match(/^\/admin\/[\s\S]*?/)) {
							// XXX have to append to index if there is more than one file for that relative path
							addIndex(relativePath, data.files[compiledFilePath]);
						}
						mkdirp.sync(path.join(path.dirname(compiledFilePath)));
						fs.writeFile(compiledFilePath, data.files[compiledFilePath], next);
					}, next);
				});
			}, function(err) {
				if (err) {
					winston.error('[meta/templates] ' + err.stack);
				} else {
					async.parallel([
						async.apply(compileIndex, viewsPath),
						async.apply(storeTypeIndex, paths, viewsPath)
					],
					function() {
						winston.verbose('[meta/templates] Successfully compiled templates.');
						emitter.emit('templates:compiled');
						if (callback) {
							callback();
						}
					});
				}
			});
		});
	});
};

var searchIndex = {};

function addIndex(path, file) {
	searchIndex[path] = file;
}

function compileIndex(viewsPath, callback) {
	fs.writeFile(path.join(viewsPath, '/indexed.json'), JSON.stringify(searchIndex), callback);
}

function storeTypeIndex(paths, viewsPath, callback) {
	var types = {};
	Object.keys(paths).forEach(function(relativePath) {
		var ext = path.extname(relativePath).substr(1),
			basename = relativePath.substr(1, relativePath.length - ext.length - 2);
		types[basename] = ext;
	});
	templatist.updateTypesCache(types);
	fs.writeFile(path.join(viewsPath, '/templateTypesCache.json'), JSON.stringify(types), callback);
}

module.exports = Templates;
