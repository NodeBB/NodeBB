'use strict';

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	winston = require('winston'),
	semver = require('semver'),
	express = require('express'),
	nconf = require('nconf'),

	db = require('./database'),
	emitter = require('./emitter'),
	meta = require('./meta'),
	translator = require('../public/src/translator'),
	utils = require('../public/src/utils'),
	hotswap = require('./hotswap'),
	pkg = require('../package.json'),

	controllers = require('./controllers'),
	app, middleware;

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
	Plugins.customLanguages = [];
	Plugins.libraryPaths = [];

	Plugins.initialized = false;

	Plugins.requireLibrary = function(pluginID, libraryPath) {
		Plugins.libraries[pluginID] = require(libraryPath);
		Plugins.libraryPaths.push(libraryPath);
	};

	Plugins.init = function(nbbApp, nbbMiddleware) {
		if (Plugins.initialized) {
			return;
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
				return;
			}

			if (global.env === 'development') {
				winston.info('[plugins] Plugins OK');
			}

			Plugins.initialized = true;
			emitter.emit('plugins:loaded');
		});

		Plugins.registerHook('core', {
			hook: 'static:app.load',
			method: addLanguages
		});
	};

	Plugins.ready = function(callback) {
		if (!Plugins.initialized) {
			emitter.once('plugins:loaded', callback);
		} else {
			callback();
		}
	};

	Plugins.reload = function(callback) {
		// Resetting all local plugin data
		Plugins.libraries = {};
		Plugins.loadedHooks = {};
		Plugins.staticDirs = {};
		Plugins.cssFiles.length = 0;
		Plugins.lessFiles.length = 0;
		Plugins.clientScripts.length = 0;
		Plugins.libraryPaths.length = 0;

		async.waterfall([
			function(next) {
				db.getSortedSetRange('plugins:active', 0, -1, next);
			},
			function(plugins, next) {
				if (!Array.isArray(plugins)) {
					return next();
				}

				plugins.push(meta.config['theme:id']);

				plugins = plugins.filter(function(plugin){
					return plugin && typeof plugin === 'string';
				}).map(function(plugin){
					return path.join(__dirname, '../node_modules/', plugin);
				});

				async.filter(plugins, fs.exists, function(plugins){
					async.eachSeries(plugins, Plugins.loadPlugin, next);
				});
			},
			function(next) {
				Object.keys(Plugins.loadedHooks).forEach(function(hook) {
					var hooks = Plugins.loadedHooks[hook];
					hooks = hooks.sort(function(a, b) {
						return a.priority - b.priority;
					});
				});

				next();
			},
			async.apply(Plugins.reloadRoutes)
		], callback);
	};

	Plugins.reloadRoutes = function(callback) {
		var router = express.Router();
		router.hotswapId = 'plugins';
		router.render = function() {
			app.render.apply(app, arguments);
		};

		Plugins.fireHook('static:app.load', {app: app, router: router, middleware: middleware, controllers: controllers}, function() {
			hotswap.replace('plugins', router);
			winston.verbose('[plugins] All plugins reloaded and rerouted');
			callback();
		});
	};

	Plugins.getTemplates = function(callback) {
		var templates = {};

		Plugins.showInstalled(function(err, plugins) {
			async.each(plugins, function(plugin, next) {
				if (plugin.templates && plugin.id && plugin.active) {
					var templatesPath = path.join(__dirname, '../node_modules', plugin.id, plugin.templates);
					utils.walk(templatesPath, function(err, pluginTemplates) {
						if (pluginTemplates) {
							pluginTemplates.forEach(function(pluginTemplate) {
								templates["/" + pluginTemplate.replace(templatesPath, '').substring(1)] = pluginTemplate;
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

	Plugins.getAll = function(callback) {
		var request = require('request');
		request((nconf.get('registry') || 'https://packages.nodebb.org') + '/api/v1/plugins?version=' + pkg.version, function(err, res, body) {
			var plugins = [];

			try {
				plugins = JSON.parse(body);
			} catch(err) {
				winston.error('Error parsing plugins : ' + err.message);
				plugins = [];
			}

			var pluginMap = {};
			for(var i=0; i<plugins.length; ++i) {
				plugins[i].id = plugins[i].name;
				plugins[i].installed = false;
				plugins[i].active = false;
				plugins[i].url = plugins[i].url ? plugins[i].url : plugins[i].repository ? plugins[i].repository.url : '';
				plugins[i].latest = plugins[i].latest;
				pluginMap[plugins[i].name] = plugins[i];
			}

			Plugins.showInstalled(function(err, installedPlugins) {
				if (err) {
					return callback(err);
				}

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
					pluginMap[plugin.id].error = plugin.error || false;
					pluginMap[plugin.id].active = plugin.active;
					pluginMap[plugin.id].version = plugin.version;
					pluginMap[plugin.id].latest = pluginMap[plugin.id].latest || plugin.version;
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
		});
	};

	function getLatestVersion(versions) {
		for(var version in versions) {
			if (versions.hasOwnProperty(version) && versions[version] === 'latest') {
				return version;
			}
		}
		return '';
	}

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
						if (err) {
							return callback(false);
						}

						callback(stats.isDirectory());
					});
				}, function(plugins){
					next(null, plugins);
				});
			},

			function(files, next) {
				var plugins = [];

				async.each(files, function(file, next) {
					var configPath;

					async.waterfall([
						function(next) {
							Plugins.loadPluginInfo(file, next);
						},
						function(pluginData, next) {
							var packageName = path.basename(file);

							if (!pluginData) {
								winston.warn("Plugin `" + packageName + "` is corrupted or invalid. Please check either package.json or plugin.json for errors.");
								return next(null, {
									id: packageName,
									installed: true,
									error: true,
									active: null
								});
							}

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
					], function(err, config) {
						if (err) {
							return next(); // Silently fail
						}

						plugins.push(config);
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
			},
		], next);
	};

	function addLanguages(params, callback) {
		Plugins.customLanguages.forEach(function(lang) {
			params.router.get('/language' + lang.route, function(req, res, next) {
				res.json(lang.file);
			});

			var components = lang.route.split('/'),
				language = components[1],
				filename = components[2].replace('.json', '');

			translator.addTranslation(language, filename, lang.file);
		});

		callback(null);
	}

}(exports));
