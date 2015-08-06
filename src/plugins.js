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
	translator = require('../public/src/modules/translator'),
	utils = require('../public/src/utils'),
	hotswap = require('./hotswap'),

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
		Plugins.cssFiles.length = 0;
		Plugins.lessFiles.length = 0;
		Plugins.clientScripts.length = 0;
		Plugins.libraryPaths.length = 0;

		Plugins.registerHook('core', {
			hook: 'static:app.load',
			method: addLanguages
		});

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

	Plugins.getAll = function(callback) {
		var url = (nconf.get('registry') || 'https://packages.nodebb.org') + '/api/v1/plugins?version=' + require('../package.json').version;

		require('request')(url, {
			json: true
		}, function(err, res, body) {
			var plugins = [];

			if (err) {
				winston.error('Error parsing plugins : ' + err.message);
				plugins = [];
			}

			Plugins.normalise(body, callback);
		});
	};

	Plugins.normalise = function(apiReturn, callback) {
		var pluginMap = {};
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

		var fallbackPath;
		for(var resource in Plugins.customLanguageFallbacks) {
			fallbackPath = Plugins.customLanguageFallbacks[resource];
			params.router.get('/language/:lang/' + resource + '.json', function(req, res, next) {
				winston.verbose('[translator] No resource file found for ' + req.params.lang + '/' + resource + ', using provided fallback language file');
				res.sendFile(fallbackPath);
			});
		}

		callback(null);
	}

}(exports));
