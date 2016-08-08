'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var winston = require('winston');
var semver = require('semver');
var express = require('express');
var nconf = require('nconf');

var db = require('./database');
var emitter = require('./emitter');
var translator = require('../public/src/modules/translator');
var utils = require('../public/src/utils');
var hotswap = require('./hotswap');
var file = require('./file');

var controllers = require('./controllers');
var app;
var middleware;

(function(Plugins) {
	require('./plugins/install')(Plugins);
	require('./plugins/load')(Plugins);
	require('./plugins/hooks')(Plugins);

	Plugins.libraries = {};
	Plugins.loadedHooks = {};
	Plugins.staticDirs = {};
	Plugins.cssFiles = [];
	Plugins.lessFiles = [];
	Plugins.clientScripts = [];
	Plugins.acpScripts = [];
	Plugins.customLanguages = {};
	Plugins.customLanguageFallbacks = {};
	Plugins.libraryPaths = [];
	Plugins.versionWarning = [];

	Plugins.initialized = false;

	Plugins.requireLibrary = function(pluginID, libraryPath) {
		Plugins.libraries[pluginID] = require(libraryPath);
		Plugins.libraryPaths.push(libraryPath);
	};

	Plugins.init = function(nbbApp, nbbMiddleware, callback) {
		callback = callback || function() {};
		if (Plugins.initialized) {
			return callback();
		}

		app = nbbApp;
		middleware = nbbMiddleware;
		hotswap.prepare(nbbApp);

		if (global.env === 'development') {
			winston.verbose('[plugins] Initializing plugins system');
		}

		Plugins.reload(function(err) {
			if (err) {
				winston.error('[plugins] NodeBB encountered a problem while loading plugins', err.message);
				return callback(err);
			}

			if (global.env === 'development') {
				winston.info('[plugins] Plugins OK');
			}

			Plugins.initialized = true;
			emitter.emit('plugins:loaded');
			callback();
		});
	};

	Plugins.reload = function(callback) {
		// Resetting all local plugin data
		Plugins.libraries = {};
		Plugins.loadedHooks = {};
		Plugins.staticDirs = {};
		Plugins.versionWarning = [];
		Plugins.cssFiles.length = 0;
		Plugins.lessFiles.length = 0;
		Plugins.clientScripts.length = 0;
		Plugins.acpScripts.length = 0;
		Plugins.libraryPaths.length = 0;

		// Plugins.registerHook('core', {
		// 	hook: 'static:app.load',
		// 	method: addLanguages
		// });

		async.waterfall([
			function(next) {
				// Build language code list
				fs.readdir(path.join(__dirname, '../public/language'), function(err, directories) {
					Plugins.languageCodes = directories.filter(function(code) {
						return code !== 'TODO';
					});

					next();
				});
			},
			function(next) {
				db.getSortedSetRange('plugins:active', 0, -1, next);
			},
			function(plugins, next) {
				if (!Array.isArray(plugins)) {
					return next();
				}

				plugins = plugins.filter(function(plugin){
					return plugin && typeof plugin === 'string';
				}).map(function(plugin){
					return path.join(__dirname, '../node_modules/', plugin);
				});

				async.filter(plugins, file.exists, function(plugins) {
					async.eachSeries(plugins, Plugins.loadPlugin, next);
				});
			},
			function(next) {
				// If some plugins are incompatible, throw the warning here
				if (Plugins.versionWarning.length && nconf.get('isPrimary') === 'true') {
					process.stdout.write('\n');
					winston.warn('[plugins/load] The following plugins may not be compatible with your version of NodeBB. This may cause unintended behaviour or crashing. In the event of an unresponsive NodeBB caused by this plugin, run `./nodebb reset -p PLUGINNAME` to disable it.');
					for(var x=0,numPlugins=Plugins.versionWarning.length;x<numPlugins;x++) {
						process.stdout.write('  * '.yellow + Plugins.versionWarning[x] + '\n');
					}
					process.stdout.write('\n');
				}

				Object.keys(Plugins.loadedHooks).forEach(function(hook) {
					var hooks = Plugins.loadedHooks[hook];
					hooks = hooks.sort(function(a, b) {
						return a.priority - b.priority;
					});
				});

				next();
			}
		], callback);
	};

	Plugins.reloadRoutes = function(callback) {
		callback = callback || function() {};
		var router = express.Router();
		router.hotswapId = 'plugins';
		router.render = function() {
			app.render.apply(app, arguments);
		};

		Plugins.fireHook('static:app.load', {app: app, router: router, middleware: middleware, controllers: controllers}, function(err) {
			if (err) {
				return winston.error('[plugins] Encountered error while executing post-router plugins hooks: ' + err.message);
			}

			hotswap.replace('plugins', router);
			winston.verbose('[plugins] All plugins reloaded and rerouted');
			callback();
		});
	};

	Plugins.getTemplates = function(callback) {
		var templates = {},
			tplName;

		async.waterfall([
			async.apply(db.getSortedSetRange, 'plugins:active', 0, -1),
			function(plugins, next) {
				var pluginBasePath = path.join(__dirname, '../node_modules');
				var paths = plugins.map(function(plugin) {
					return path.join(pluginBasePath, plugin);
				});

				// Filter out plugins with invalid paths
				async.filter(paths, file.exists, function(paths) {
					next(null, paths);
				});
			},
			function(paths, next) {
				async.map(paths, Plugins.loadPluginInfo, next);
			}
		], function(err, plugins) {
			if (err) {
				return callback(err);
			}

			async.eachSeries(plugins, function(plugin, next) {
				if (plugin.templates || plugin.id.startsWith('nodebb-theme-')) {
					winston.verbose('[plugins] Loading templates (' + plugin.id + ')');
					var templatesPath = path.join(__dirname, '../node_modules', plugin.id, plugin.templates || 'templates');
					utils.walk(templatesPath, function(err, pluginTemplates) {
						if (pluginTemplates) {
							pluginTemplates.forEach(function(pluginTemplate) {
								if (pluginTemplate.endsWith('.tpl')) {
									tplName = "/" + pluginTemplate.replace(templatesPath, '').substring(1);

									if (templates.hasOwnProperty(tplName)) {
										winston.verbose('[plugins] ' + tplName + ' replaced by ' + plugin.id);
									}

									templates[tplName] = pluginTemplate;
								} else {
									winston.warn('[plugins] Skipping ' + pluginTemplate + ' by plugin ' + plugin.id);
								}
							});
						} else {
							winston.warn('[plugins/' + plugin.id + '] A templates directory was defined for this plugin, but was not found.');
						}

						next(false);
					});
				} else {
					next(false);
				}
			}, function(err) {
				callback(err, templates);
			});
		});
	};

	Plugins.get = function(id, callback) {
		var url = (nconf.get('registry') || 'https://packages.nodebb.org') + '/api/v1/plugins/' + id;

		require('request')(url, {
			json: true
		}, function(err, res, body) {
			if (res.statusCode === 404 || !body.payload) {
				return callback(err, {});
			}

			Plugins.normalise([body.payload], function(err, normalised) {
				normalised = normalised.filter(function(plugin) {
					return plugin.id === id;
				});
				return callback(err, !err ? normalised[0] : undefined);
			});
		});
	};

	Plugins.list = function(matching, callback) {
		if (arguments.length === 1 && typeof matching === 'function') {
			callback = matching;
			matching = true;
		}

		var url = (nconf.get('registry') || 'https://packages.nodebb.org') + '/api/v1/plugins' + (matching !== false ? '?version=' + require('../package.json').version : '');

		require('request')(url, {
			json: true
		}, function(err, res, body) {
			if (err) {
				winston.error('Error parsing plugins : ' + err.message);
			}

			Plugins.normalise(body, callback);
		});
	};

	Plugins.normalise = function(apiReturn, callback) {
		var pluginMap = {};
		var dependencies = require.main.require('./package.json').dependencies;
		apiReturn = apiReturn || [];
		for(var i=0; i<apiReturn.length; ++i) {
			apiReturn[i].id = apiReturn[i].name;
			apiReturn[i].installed = false;
			apiReturn[i].active = false;
			apiReturn[i].url = apiReturn[i].url ? apiReturn[i].url : apiReturn[i].repository ? apiReturn[i].repository.url : '';
			apiReturn[i].latest = apiReturn[i].latest;
			pluginMap[apiReturn[i].name] = apiReturn[i];
		}

		Plugins.showInstalled(function(err, installedPlugins) {
			if (err) {
				return callback(err);
			}

			installedPlugins = installedPlugins.filter(function(plugin) {
				return plugin && !plugin.system;
			});

			async.each(installedPlugins, function(plugin, next) {
				// If it errored out because a package.json or plugin.json couldn't be read, no need to do this stuff
				if (plugin.error) {
					pluginMap[plugin.id] = pluginMap[plugin.id] || {};
					pluginMap[plugin.id].installed = true;
					pluginMap[plugin.id].error = true;
					return next();
				}

				pluginMap[plugin.id] = pluginMap[plugin.id] || {};
				pluginMap[plugin.id].id = pluginMap[plugin.id].id || plugin.id;
				pluginMap[plugin.id].name = plugin.name || pluginMap[plugin.id].name;
				pluginMap[plugin.id].description = plugin.description;
				pluginMap[plugin.id].url = pluginMap[plugin.id].url || plugin.url;
				pluginMap[plugin.id].installed = true;
				pluginMap[plugin.id].isTheme = !!plugin.id.match('nodebb-theme-');
				pluginMap[plugin.id].error = plugin.error || false;
				pluginMap[plugin.id].active = plugin.active;
				pluginMap[plugin.id].version = plugin.version;

				// If package.json defines a version to use, stick to that
				if (dependencies.hasOwnProperty(plugin.id) && semver.valid(dependencies[plugin.id])) {
					pluginMap[plugin.id].latest = dependencies[plugin.id];
				} else {
					pluginMap[plugin.id].latest = pluginMap[plugin.id].latest || plugin.version;
				}
				pluginMap[plugin.id].outdated = semver.gt(pluginMap[plugin.id].latest, pluginMap[plugin.id].version);
				next();
			}, function(err) {
				if (err) {
					return callback(err);
				}

				var pluginArray = [];

				for (var key in pluginMap) {
					if (pluginMap.hasOwnProperty(key)) {
						pluginArray.push(pluginMap[key]);
					}
				}

				pluginArray.sort(function(a, b) {
					if (a.name > b.name ) {
						return 1;
					} else if (a.name < b.name ){
						return -1;
					} else {
						return 0;
					}
				});

				callback(null, pluginArray);
			});
		});
	};

	Plugins.showInstalled = function(callback) {
		var npmPluginPath = path.join(__dirname, '../node_modules');

		async.waterfall([
			async.apply(fs.readdir, npmPluginPath),

			function(dirs, next) {
				dirs = dirs.filter(function(dir){
					return dir.startsWith('nodebb-plugin-') ||
						dir.startsWith('nodebb-widget-') ||
						dir.startsWith('nodebb-rewards-') ||
						dir.startsWith('nodebb-theme-');
				}).map(function(dir){
					return path.join(npmPluginPath, dir);
				});

				async.filter(dirs, function(dir, callback){
					fs.stat(dir, function(err, stats){
						callback(!err && stats.isDirectory());
					});
				}, function(plugins){
					next(null, plugins);
				});
			},

			function(files, next) {
				var plugins = [];

				async.each(files, function(file, next) {
					async.waterfall([
						function(next) {
							Plugins.loadPluginInfo(file, next);
						},
						function(pluginData, next) {
							Plugins.isActive(pluginData.name, function(err, active) {
								if (err) {
									return next(new Error('no-active-state'));
								}

								delete pluginData.hooks;
								delete pluginData.library;
								pluginData.active = active;
								pluginData.installed = true;
								pluginData.error = false;
								next(null, pluginData);
							});
						}
					], function(err, pluginData) {
						if (err) {
							return next(); // Silently fail
						}

						plugins.push(pluginData);
						next();
					});
				}, function(err) {
					next(null, plugins);
				});
			}
		], callback);
	};

	Plugins.clearRequireCache = function(next) {
		var cached = Object.keys(require.cache);
		async.waterfall([
			async.apply(async.map, Plugins.libraryPaths, fs.realpath),
			function(paths, next) {
				paths = paths.map(function(pluginLib) {
					var parent = path.dirname(pluginLib);
					return cached.filter(function(libPath) {
						return libPath.indexOf(parent) !== -1;
					});
				}).reduce(function(prev, cur) {
					return prev.concat(cur);
				});

				Plugins.fireHook('filter:plugins.clearRequireCache', {paths: paths}, next);
			},
			function(data, next) {
				for (var x=0,numPaths=data.paths.length;x<numPaths;x++) {
					delete require.cache[data.paths[x]];
				}
				winston.verbose('[plugins] Plugin libraries removed from Node.js cache');

				next();
			}
		], next);
	};

}(exports));
