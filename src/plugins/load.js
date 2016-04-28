'use strict';

var fs = require('fs'),
	path = require('path'),
	semver = require('semver'),
	async = require('async'),
	winston = require('winston'),
	nconf = require('nconf'),
	_ = require('underscore'),
	file = require('../file');

var utils = require('../../public/src/utils'),
	meta = require('../meta');


module.exports = function(Plugins) {

	Plugins.loadPlugin = function(pluginPath, callback) {
		Plugins.loadPluginInfo(pluginPath, function(err, pluginData) {
			if (err) {
				if (err.message === '[[error:parse-error]]') {
					return callback();
				}
				return callback(pluginPath.match('nodebb-theme') ? null : err);
			}

			checkVersion(pluginData);

			async.parallel([
				function(next) {
					registerHooks(pluginData, pluginPath, next);
				},
				function(next) {
					mapStaticDirectories(pluginData, pluginPath, next);
				},
				function(next) {
					mapFiles(pluginData, 'css', 'cssFiles', next);
				},
				function(next) {
					mapFiles(pluginData, 'less', 'lessFiles', next);
				},
				function(next) {
					mapClientSideScripts(pluginData, next);
				},
				function(next) {
					mapClientModules(pluginData, next);
				},
				function(next) {
					loadLanguages(pluginData, next);
				},
				function(next) {
					registerSettingsPage(pluginData, pluginPath, next);
				}
			], function(err) {
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
			ensureLibraryLoaded(pluginData.id, libraryPath);

			if (Array.isArray(pluginData.hooks) && pluginData.hooks.length > 0) {
				async.each(pluginData.hooks, function(hook, next) {
					Plugins.registerHook(pluginData.id, hook, next);
				}, callback);
			} else {
				callback();
			}
		} catch(err) {
			logLibraryLoadErr(pluginData.id, err.stack);
			callback();
		}
	}

	function mapStaticDirectories(pluginData, pluginPath, callback) {
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

				file.exists(staticDir, function(exists) {
					if (exists) {
						Plugins.staticDirs[pluginData.id + '/' + mappedPath] = staticDir;
					} else {
						winston.warn('[plugins/' + pluginData.id + '] Mapped path \'' + mappedPath + ' => ' + staticDir + '\' not found.');
					}
					callback();
				});
			}
		}

		var validMappedPath = /^[\w\-_]+$/;

		pluginData.staticDirs = pluginData.staticDirs || {};

		var dirs = Object.keys(pluginData.staticDirs);
		async.each(dirs, mapStaticDirs, callback);
	}

	function mapFiles(pluginData, type, globalArray, callback) {
		if (Array.isArray(pluginData[type])) {
			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + pluginData[type].length + ' ' + type + ' file(s) for plugin ' + pluginData.id);
			}

			Plugins[globalArray] = Plugins[globalArray].concat(pluginData[type].map(function(file) {
				return path.join(pluginData.id, file);
			}));
		}
		callback();
	}

	function mapClientSideScripts(pluginData, callback) {
		if (Array.isArray(pluginData.scripts)) {
			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + pluginData.scripts.length + ' js file(s) for plugin ' + pluginData.id);
			}

			Plugins.clientScripts = Plugins.clientScripts.concat(pluginData.scripts.map(function(file) {
				return path.join(__dirname, '../../node_modules/', pluginData.id, file);
			}));
		}

		if (Array.isArray(pluginData.acpScripts)) {
			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + pluginData.acpScripts.length + ' js file(s) for plugin ' + pluginData.id);
			}

			Plugins.acpScripts = Plugins.acpScripts.concat(pluginData.acpScripts.map(function(file) {
				return path.join(__dirname, '../../node_modules/', pluginData.id, file);
			}));
		}

		callback();
	}

	function mapClientModules(pluginData, callback) {
		if (Array.isArray(pluginData.modules)) {
			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + pluginData.modules.length + ' AMD-style module(s) for plugin ' + pluginData.id);
			}

			meta.js.scripts.modules = meta.js.scripts.modules.concat(pluginData.modules.map(function(file) {
				return path.join('./node_modules/', pluginData.id, file);
			}));
		}

		callback();
	}

	function loadLanguages(pluginData, callback) {
		if (typeof pluginData.languages !== 'string') {
			return callback();
		}

		var pathToFolder = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages),
			fallbackMap = {};

		utils.walk(pathToFolder, function(err, languages) {
			var arr = [];

			async.each(languages, function(pathToLang, next) {
				fs.readFile(pathToLang, function(err, file) {
					if (err) {
						return next(err);
					}
					var json;

					try {
						json = JSON.parse(file.toString());
					} catch (err) {
						winston.error('[plugins] Unable to parse custom language file: ' + pathToLang + '\r\n' + err.stack);
						return next(err);
					}

					arr.push({
						file: json,
						route: pathToLang.replace(pathToFolder, '')
					});

					if (pluginData.defaultLang && pathToLang.endsWith(pluginData.defaultLang + '/' + path.basename(pathToLang))) {
						fallbackMap[path.basename(pathToLang, '.json')] = path.join(pathToFolder, pluginData.defaultLang, path.basename(pathToLang));
					}

					next();
				});
			}, function(err) {
				if (err) {
					return callback(err);
				}

				Plugins.customLanguages = Plugins.customLanguages.concat(arr);
				_.extendOwn(Plugins.customLanguageFallbacks, fallbackMap);

				callback();
			});
		});
	}

	function registerSettingsPage(pluginData, pluginPath, callback) {
		if (!pluginData.library) {
			return callback();
		}

		var settingsPage = pluginData.settingsPage;
		var libraryPath = path.join(pluginPath, pluginData.library);
		var settingsRouteRX = /nodebb-(?:plugin|rewards|theme|widget)-(.*)/;

		if (settingsPage) {
			try {
				ensureLibraryLoaded(pluginData.id, libraryPath);

				var logTag = '[plugins/' + pluginData.id + ']';

				var headerBuildHooks = Plugins.loadedHooks['filter:admin.header.build'];
				var redundantHook = _.findWhere(headerBuildHooks, {id: pluginData.id});
				if (redundantHook) {
					winston.warn(logTag + ' Deprecation warning: No need to use filter:admin.header.build when "settingsPage" is defined in plugin.json!');
					Plugins.loadedHooks['filter:admin.header.build'] = _.without(headerBuildHooks, redundantHook);
				}

				var renderMethod;
				Plugins.settingsPages[pluginData.id] = {};
				Plugins.settingsPages[pluginData.id].name = settingsPage.name;
				Plugins.settingsPages[pluginData.id].route = '/plugins/' + pluginData.id.match(settingsRouteRX)[1];
				renderMethod = Plugins.getMethodRef(pluginData.id, settingsPage.renderMethod) || settingsPage.renderMethod;
				if (typeof renderMethod !== 'function') {
					winston.error(logTag + ' Unable to find settings page\'s render method: ' + renderMethod);
					delete Plugins.settingsPages[pluginData.id];
					return callback();
				} else {
					Plugins.settingsPages[pluginData.id].renderMethod = renderMethod;
				}
				Plugins.settingsPages[pluginData.id].isAuthentication = settingsPage.isAuthentication;

				Plugins.settingsPages[pluginData.id].middlewares = [];
				if (Array.isArray(settingsPage.middlewares) && settingsPage.middlewares.length > 0) {
					async.each(settingsPage.middlewares, function(middleware, next) {
						var middlewareRef = Plugins.getMethodRef(pluginData.id, middleware) || middleware;
						if (typeof middlewareRef !== 'function') {
							winston.warn(logTag + ' Unable to find middleware method: ' + middlewareRef);
						} else {
							Plugins.settingsPages[pluginData.id].middlewares.push(middlewareRef);
						}
						next();
					}, callback);
				}

			} catch (err) {
				logLibraryLoadErr(pluginData.id, err.stack);
				callback(err);
			}
		} else {
			callback();
		}
	}

	function ensureLibraryLoaded(id, libraryPath) {
		if (!Plugins.libraries[id]) {
				Plugins.requireLibrary(id, libraryPath);
		}
	}

	function logLibraryLoadErr(id, stack) {
		winston.error(stack);
		winston.warn('[plugins] Unable to parse library for: ' + id);
	}

	Plugins.loadPluginInfo = function(pluginPath, callback) {
		async.parallel({
			package: function(next) {
				fs.readFile(path.join(pluginPath, 'package.json'), next);
			},
			plugin: function(next) {
				fs.readFile(path.join(pluginPath, 'plugin.json'), next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			try {
				var pluginData = JSON.parse(results.plugin);
				var packageData = JSON.parse(results.package);

				pluginData.id = packageData.name;
				pluginData.name = packageData.name;
				pluginData.description = packageData.description;
				pluginData.version = packageData.version;
				pluginData.repository = packageData.repository;
				pluginData.nbbpm = packageData.nbbpm;

				callback(null, pluginData);
			} catch(err) {
				var pluginDir = pluginPath.split(path.sep);
				pluginDir = pluginDir[pluginDir.length -1];

				winston.error('[plugins/' + pluginDir + '] Error in plugin.json or package.json! ' + err.message);

				callback(new Error('[[error:parse-error]]'));
			}
		});
	};
};
