'use strict';

var db = require('../database');
var fs = require('fs');
var path = require('path');
var semver = require('semver');
var async = require('async');
var winston = require('winston');
var nconf = require('nconf');
var _ = require('underscore');
var file = require('../file');
var meta = require('../meta');


module.exports = function (Plugins) {
	Plugins.getPluginPaths = function (callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('plugins:active', 0, -1, next);
			},
			function (plugins, next) {
				if (!Array.isArray(plugins)) {
					return next();
				}

				plugins = plugins.filter(function (plugin) {
					return plugin && typeof plugin === 'string';
				}).map(function (plugin) {
					return path.join(__dirname, '../../node_modules/', plugin);
				});

				async.filter(plugins, file.exists, next);
			},
		], callback);
	};

	Plugins.prepareForBuild = function (callback) {
		Plugins.cssFiles.length = 0;
		Plugins.lessFiles.length = 0;
		Plugins.clientScripts.length = 0;
		Plugins.acpScripts.length = 0;
		Plugins.soundpacks.length = 0;

		async.waterfall([
			async.apply(Plugins.getPluginPaths),
			function (paths, next) {
				async.map(paths, function (path, next) {
					Plugins.loadPluginInfo(path, next);
				}, next);
			},
			function (plugins, next) {
				async.each(plugins, function (pluginData, next) {
					async.parallel([
						async.apply(mapFiles, pluginData, 'css', 'cssFiles'),
						async.apply(mapFiles, pluginData, 'less', 'lessFiles'),
						async.apply(mapClientSideScripts, pluginData),
						async.apply(mapClientModules, pluginData),
						async.apply(mapStaticDirectories, pluginData, pluginData.path),
						async.apply(mapSoundpack, pluginData),
					], next);
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
					registerHooks(pluginData, pluginPath, next);
				},
				function (next) {
					mapStaticDirectories(pluginData, pluginPath, next);
				},
				function (next) {
					mapFiles(pluginData, 'css', 'cssFiles', next);
				},
				function (next) {
					mapFiles(pluginData, 'less', 'lessFiles', next);
				},
				function (next) {
					mapClientSideScripts(pluginData, next);
				},
				function (next) {
					mapClientModules(pluginData, next);
				},
				function (next) {
					mapSoundpack(pluginData, next);
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

	function registerHooks(pluginData, pluginPath, callback) {
		if (!pluginData.library) {
			return callback();
		}

		var libraryPath = path.join(pluginPath, pluginData.library);

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

	function mapStaticDirectories(pluginData, pluginPath, callback) {
		var validMappedPath = /^[\w\-_]+$/;

		function mapStaticDirs(mappedPath, callback) {
			if (Plugins.staticDirs[mappedPath]) {
				winston.warn('[plugins/' + pluginData.id + '] Mapped path (' + mappedPath + ') already specified!');
				callback();
			} else if (!validMappedPath.test(mappedPath)) {
				winston.warn('[plugins/' + pluginData.id + '] Invalid mapped path specified: ' + mappedPath + '. Path must adhere to: ' + validMappedPath.toString());
				callback();
			} else {
				var realPath = pluginData.staticDirs[mappedPath];
				var staticDir = path.join(pluginPath, realPath);

				file.exists(staticDir, function (err, exists) {
					if (exists) {
						Plugins.staticDirs[pluginData.id + '/' + mappedPath] = staticDir;
					} else {
						winston.warn('[plugins/' + pluginData.id + '] Mapped path \'' + mappedPath + ' => ' + staticDir + '\' not found.');
					}
					callback(err);
				});
			}
		}

		pluginData.staticDirs = pluginData.staticDirs || {};

		var dirs = Object.keys(pluginData.staticDirs);
		async.each(dirs, mapStaticDirs, callback);
	}

	function mapFiles(pluginData, type, globalArray, callback) {
		if (Array.isArray(pluginData[type])) {
			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + pluginData[type].length + ' ' + type + ' file(s) for plugin ' + pluginData.id);
			}

			Plugins[globalArray] = Plugins[globalArray].concat(pluginData[type].map(function (file) {
				return path.join(pluginData.id, file);
			}));
		}
		callback();
	}

	function mapClientSideScripts(pluginData, callback) {
		function mapScripts(scripts, param) {
			if (Array.isArray(scripts) && scripts.length) {
				if (global.env === 'development') {
					winston.verbose('[plugins] Found ' + scripts.length + ' js file(s) for plugin ' + pluginData.id);
				}

				Plugins[param] = Plugins[param].concat(scripts.map(function (file) {
					return resolveModulePath(path.join(__dirname, '../../node_modules/', pluginData.id, file), file);
				})).filter(Boolean);
			}
		}
		mapScripts(pluginData.scripts, 'clientScripts');
		mapScripts(pluginData.acpScripts, 'acpScripts');

		callback();
	}

	function mapClientModules(pluginData, callback) {
		if (!pluginData.hasOwnProperty('modules')) {
			return callback();
		}

		var modules = {};

		if (Array.isArray(pluginData.modules)) {
			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + pluginData.modules.length + ' AMD-style module(s) for plugin ' + pluginData.id);
			}

			var strip = pluginData.hasOwnProperty('modulesStrip') ? parseInt(pluginData.modulesStrip, 10) : 0;

			pluginData.modules.forEach(function (file) {
				if (strip) {
					modules[file.replace(new RegExp('.?(/[^/]+){' + strip + '}/'), '')] = path.join('./node_modules/', pluginData.id, file);
				} else {
					modules[path.basename(file)] = path.join('./node_modules/', pluginData.id, file);
				}
			});

			meta.js.scripts.modules = _.extend(meta.js.scripts.modules, modules);
		} else {
			var keys = Object.keys(pluginData.modules);

			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + keys.length + ' AMD-style module(s) for plugin ' + pluginData.id);
			}

			for (var name in pluginData.modules) {
				if (pluginData.modules.hasOwnProperty(name)) {
					modules[name] = path.join('./node_modules/', pluginData.id, pluginData.modules[name]);
				}
			}

			meta.js.scripts.modules = _.extend(meta.js.scripts.modules, modules);
		}

		callback();
	}

	function mapSoundpack(pluginData, callback) {
		var soundpack = pluginData.soundpack;
		if (!soundpack || !soundpack.dir || !soundpack.sounds) {
			return callback();
		}
		soundpack.name = soundpack.name || pluginData.name;
		soundpack.id = pluginData.id;
		soundpack.dir = path.join(pluginData.path, soundpack.dir);
		async.each(Object.keys(soundpack.sounds), function (key, next) {
			file.exists(path.join(soundpack.dir, soundpack.sounds[key]), function (err, exists) {
				if (!exists) {
					delete soundpack.sounds[key];
				}

				next(err);
			});
		}, function (err) {
			if (err) {
				return callback(err);
			}

			if (Object.keys(soundpack.sounds).length) {
				Plugins.soundpacks.push(soundpack);
			}

			callback();
		});
	}

	function resolveModulePath(fullPath, relPath) {
		/**
		  * With npm@3, dependencies can become flattened, and appear at the root level.
		  * This method resolves these differences if it can.
		  */
		var matches = fullPath.match(/node_modules/g);
		var atRootLevel = !matches || matches.length === 1;

		try {
			fs.statSync(fullPath);
			winston.verbose('[plugins/load] File found: ' + fullPath);
			return fullPath;
		} catch (e) {
			// File not visible to the calling process, ascend to root level if possible and try again
			if (!atRootLevel && relPath) {
				winston.verbose('[plugins/load] File not found: ' + fullPath + ' (Ascending)');
				return resolveModulePath(path.join(__dirname, '../..', relPath));
			}
				// Already at root level, file was simply not found
			winston.warn('[plugins/load] File not found: ' + fullPath + ' (Ignoring)');
			return null;
		}
	}

	Plugins.loadPluginInfo = function (pluginPath, callback) {
		async.parallel({
			package: function (next) {
				fs.readFile(path.join(pluginPath, 'package.json'), next);
			},
			plugin: function (next) {
				fs.readFile(path.join(pluginPath, 'plugin.json'), next);
			},
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			var pluginData;
			var packageData;
			try {
				pluginData = JSON.parse(results.plugin);
				packageData = JSON.parse(results.package);

				pluginData.id = packageData.name;
				pluginData.name = packageData.name;
				pluginData.description = packageData.description;
				pluginData.version = packageData.version;
				pluginData.repository = packageData.repository;
				pluginData.nbbpm = packageData.nbbpm;
				pluginData.path = pluginPath;
			} catch (err) {
				var pluginDir = pluginPath.split(path.sep);
				pluginDir = pluginDir[pluginDir.length - 1];

				winston.error('[plugins/' + pluginDir + '] Error in plugin.json or package.json! ' + err.message);

				return callback(new Error('[[error:parse-error]]'));
			}

			callback(null, pluginData);
		});
	};
};
