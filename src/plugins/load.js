'use strict';

var path = require('path');
var semver = require('semver');
var async = require('async');
var winston = require('winston');
var nconf = require('nconf');

var meta = require('../meta');

module.exports = function (Plugins) {
	function registerPluginAssets(pluginData, callback) {
		function add(dest, arr) {
			dest.push.apply(dest, arr);
		}

		async.parallel({
			staticDirs: function (next) {
				Plugins.data.getStaticDirectories(pluginData, next);
			},
			cssFiles: function (next) {
				Plugins.data.getFiles(pluginData, 'css', next);
			},
			lessFiles: function (next) {
				Plugins.data.getFiles(pluginData, 'less', next);
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
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			Object.assign(Plugins.staticDirs, results.staticDirs);
			add(Plugins.cssFiles, results.cssFiles);
			add(Plugins.lessFiles, results.lessFiles);
			add(Plugins.clientScripts, results.clientScripts);
			add(Plugins.acpScripts, results.acpScripts);
			Object.assign(meta.js.scripts.modules, results.modules);
			if (results.soundpack) {
				Plugins.soundpacks.push(results.soundpack);
			}

			callback();
		});
	}

	Plugins.prepareForBuild = function (callback) {
		Plugins.cssFiles.length = 0;
		Plugins.lessFiles.length = 0;
		Plugins.clientScripts.length = 0;
		Plugins.acpScripts.length = 0;
		Plugins.soundpacks.length = 0;

		async.waterfall([
			Plugins.data.getAll,
			function (plugins, next) {
				async.each(plugins, function (pluginData, next) {
					registerPluginAssets(pluginData, next);
				}, next);
			},
		], callback);
	};

	Plugins.loadPlugin = function (pluginPath, callback) {
		Plugins.loadPluginInfo(pluginPath, function (err, pluginData) {
			if (err) {
				if (err.message === '[[error:parse-error]]') {
					return callback();
				}
				return callback(pluginPath.match('nodebb-theme') ? null : err);
			}

			checkVersion(pluginData);

			async.parallel([
				function (next) {
					registerHooks(pluginData, next);
				},
				function (next) {
					registerPluginAssets(pluginData, next);
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
