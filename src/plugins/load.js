'use strict';

var path = require('path');
var semver = require('semver');
var async = require('async');
var winston = require('winston');
var nconf = require('nconf');
var _ = require('lodash');

var meta = require('../meta');

module.exports = function (Plugins) {
	function registerPluginAssets(pluginData, fields, callback) {
		function add(dest, arr) {
			dest.push.apply(dest, arr || []);
		}

		var handlers = {
			staticDirs: function (next) {
				Plugins.data.getStaticDirectories(pluginData, next);
			},
			cssFiles: function (next) {
				Plugins.data.getFiles(pluginData, 'css', next);
			},
			lessFiles: function (next) {
				Plugins.data.getFiles(pluginData, 'less', next);
			},
			acpLessFiles: function (next) {
				Plugins.data.getFiles(pluginData, 'acpLess', next);
			},
			clientScripts: function (next) {
				Plugins.data.getScripts(pluginData, 'client', next);
			},
			acpScripts: function (next) {
				Plugins.data.getScripts(pluginData, 'acp', next);
			},
			modules: function (next) {
				Plugins.data.getModules(pluginData, next);
			},
			soundpack: function (next) {
				Plugins.data.getSoundpack(pluginData, next);
			},
			languageData: function (next) {
				Plugins.data.getLanguageData(pluginData, next);
			},
		};

		var methods;
		if (Array.isArray(fields)) {
			methods = fields.reduce(function (prev, field) {
				prev[field] = handlers[field];
				return prev;
			}, {});
		} else {
			methods = handlers;
		}

		async.parallel(methods, function (err, results) {
			if (err) {
				return callback(err);
			}

			Object.assign(Plugins.staticDirs, results.staticDirs || {});
			add(Plugins.cssFiles, results.cssFiles);
			add(Plugins.lessFiles, results.lessFiles);
			add(Plugins.acpLessFiles, results.acpLessFiles);
			add(Plugins.clientScripts, results.clientScripts);
			add(Plugins.acpScripts, results.acpScripts);
			Object.assign(meta.js.scripts.modules, results.modules || {});
			if (results.soundpack) {
				Plugins.soundpacks.push(results.soundpack);
			}
			if (results.languageData) {
				Plugins.languageData.languages = _.union(Plugins.languageData.languages, results.languageData.languages);
				Plugins.languageData.namespaces = _.union(Plugins.languageData.namespaces, results.languageData.namespaces);
			}
			Plugins.pluginsData[pluginData.id] = pluginData;

			callback();
		});
	}

	Plugins.prepareForBuild = function (targets, callback) {
		Plugins.cssFiles.length = 0;
		Plugins.lessFiles.length = 0;
		Plugins.acpLessFiles.length = 0;
		Plugins.clientScripts.length = 0;
		Plugins.acpScripts.length = 0;
		Plugins.soundpacks.length = 0;
		Plugins.languageData.languages = [];
		Plugins.languageData.namespaces = [];

		var map = {
			'plugin static dirs': ['staticDirs'],
			'requirejs modules': ['modules'],
			'client js bundle': ['clientScripts'],
			'admin js bundle': ['acpScripts'],
			'client side styles': ['cssFiles', 'lessFiles'],
			'admin control panel styles': ['cssFiles', 'lessFiles', 'acpLessFiles'],
			sounds: ['soundpack'],
			languages: ['languageData'],
		};

		var fields = targets.reduce(function (prev, target) {
			if (!map[target]) {
				return prev;
			}
			return prev.concat(map[target]);
		}, []).filter(function (field, i, arr) {
			return arr.indexOf(field) === i;
		});

		winston.verbose('[plugins] loading the following fields from plugin data: ' + fields.join(', '));

		async.waterfall([
			Plugins.data.getActive,
			function (plugins, next) {
				async.each(plugins, function (pluginData, next) {
					registerPluginAssets(pluginData, fields, next);
				}, next);
			},
		], callback);
	};

	var themeNamePattern = /(@.*?\/)?nodebb-theme-.*$/;

	Plugins.loadPlugin = function (pluginPath, callback) {
		Plugins.data.loadPluginInfo(pluginPath, function (err, pluginData) {
			if (err) {
				if (err.message === '[[error:parse-error]]') {
					return callback();
				}

				return callback(themeNamePattern.test(pluginPath) ? null : err);
			}

			checkVersion(pluginData);

			async.parallel([
				function (next) {
					registerHooks(pluginData, next);
				},
				function (next) {
					registerPluginAssets(pluginData, ['soundpack'], next);
				},
			], function (err) {
				if (err) {
					winston.verbose('[plugins] Could not load plugin : ' + pluginData.id);
					return callback(err);
				}

				winston.verbose('[plugins] Loaded plugin: ' + pluginData.id);
				callback();
			});
		});
	};

	function checkVersion(pluginData) {
		function add() {
			if (Plugins.versionWarning.indexOf(pluginData.id) === -1) {
				Plugins.versionWarning.push(pluginData.id);
			}
		}

		if (pluginData.nbbpm && pluginData.nbbpm.compatibility && semver.validRange(pluginData.nbbpm.compatibility)) {
			if (!semver.satisfies(nconf.get('version'), pluginData.nbbpm.compatibility)) {
				add();
			}
		} else {
			add();
		}
	}

	function registerHooks(pluginData, callback) {
		if (!pluginData.library) {
			return callback();
		}

		var libraryPath = path.join(pluginData.path, pluginData.library);

		try {
			if (!Plugins.libraries[pluginData.id]) {
				Plugins.requireLibrary(pluginData.id, libraryPath);
			}

			if (Array.isArray(pluginData.hooks) && pluginData.hooks.length > 0) {
				async.each(pluginData.hooks, function (hook, next) {
					Plugins.registerHook(pluginData.id, hook, next);
				}, callback);
			} else {
				callback();
			}
		} catch (err) {
			winston.error(err.stack);
			winston.warn('[plugins] Unable to parse library for: ' + pluginData.id);
			callback();
		}
	}
};
