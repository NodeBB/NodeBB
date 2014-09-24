"use strict";

var mkdirp = require('mkdirp'),
	rimraf = require('rimraf'),
	winston = require('winston'),
	async = require('async'),
	path = require('path'),
	fs = require('fs'),
	nconf = require('nconf'),
	cluster = require('cluster'),

	emitter = require('../emitter'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),

	Templates = {};

Templates.compile = function(callback) {
	if (cluster.isWorker && process.env.cluster_setup !== 'true') {
		return setTimeout(function() {
			emitter.emit('templates:compiled');
			if (callback) {
				callback();
			}
		}, 1000);
	}

	var coreTemplatesPath = nconf.get('core_templates_path'),
		baseTemplatesPath = nconf.get('base_templates_path'),
		viewsPath = nconf.get('views_dir'),
		themeTemplatesPath = nconf.get('theme_templates_path');

	plugins.getTemplates(function(err, pluginTemplates) {
		winston.info('[meta/templates] Compiling templates');
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
				var file = fs.readFileSync(paths[relativePath]).toString(),
					matches = null,
					regex = /[ \t]*<!-- IMPORT ([\s\S]*?)? -->[ \t]*/;

				while(matches = file.match(regex)) {
					var partial = "/" + matches[1];

					if (paths[partial] && relativePath !== partial) {
						file = file.replace(regex, fs.readFileSync(paths[partial]).toString());
					} else {
						winston.warn('[themes] Partial not loaded: ' + matches[1]);
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
					winston.error('[themes] ' + err.stack);
				} else {
					compileIndex(viewsPath, function() {
						winston.info('[themes] Successfully compiled templates.');
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

module.exports = Templates;