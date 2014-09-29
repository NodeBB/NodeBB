'use strict';

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	winston = require('winston'),
	nconf = require('nconf'),
	semver = require('semver'),
	express = require('express'),

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

	Plugins.libraries = {};
	Plugins.loadedHooks = {};
	Plugins.staticDirs = {};
	Plugins.cssFiles = [];
	Plugins.lessFiles = [];
	Plugins.clientScripts = [];
	Plugins.customLanguages = [];

	Plugins.initialized = false;

	Plugins.init = function(nbbApp, nbbMiddleware) {
		if (Plugins.initialized) {
			return;
		}

		app = nbbApp;
		middleware = nbbMiddleware;
		hotswap.prepare(nbbApp);

		if (global.env === 'development') {
			winston.info('[plugins] Initializing plugins system');
		}

		Plugins.reload(function(err) {
			if (err) {
				if (global.env === 'development') {
					winston.info('[plugins] NodeBB encountered a problem while loading plugins', err.message);
				}
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
		Plugins.loadedHooks = {};
		Plugins.staticDirs = {};
		Plugins.cssFiles.length = 0;
		Plugins.lessFiles.length = 0;
		Plugins.clientScripts.length = 0;

		// Read the list of activated plugins and require their libraries
		async.waterfall([
			function(next) {
				db.getSetMembers('plugins:active', next);
			},
			function(plugins, next) {
				if (!plugins || !Array.isArray(plugins)) {
					return next();
				}

				plugins.push(meta.config['theme:id']);

				plugins = plugins.filter(function(plugin){
					return plugin && typeof plugin === 'string';
				}).map(function(plugin){
					return path.join(__dirname, '../node_modules/', plugin);
				});

				async.filter(plugins, fs.exists, function(plugins){
					async.each(plugins, Plugins.loadPlugin, next);
				});
			},
			function(next) {
				if (global.env === 'development') {
					winston.info('[plugins] Sorting hooks to fire in priority sequence');
				}
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

		// Deprecated as of v0.5.0, remove this hook call for NodeBB v0.6.0-1
		Plugins.fireHook('action:app.load', router, middleware, controllers);

		Plugins.fireHook('static:app.load', router, middleware, controllers, function() {
			hotswap.replace('plugins', router);
			winston.info('[plugins] All plugins reloaded and rerouted');
			callback();
		});
	};

	Plugins.loadPlugin = function(pluginPath, callback) {
		fs.readFile(path.join(pluginPath, 'plugin.json'), function(err, data) {
			if (err) {
				return callback(pluginPath.match('nodebb-theme') ? null : err);
			}

			try {
				var pluginData = JSON.parse(data),
					libraryPath, staticDir;
			} catch (err) {
				var pluginDir = pluginPath.split(path.sep);
				pluginDir = pluginDir[pluginDir.length -1];

				winston.error('[plugins/' + pluginDir + '] Plugin not loaded - please check its plugin.json for errors');
				return callback();
			}

			/*
				Starting v0.5.0, `minver` is deprecated in favour of `compatibility`.
				`minver` will be transparently parsed to `compatibility` until v0.6.0,
				at which point `minver` will not be parsed altogether.

				Please see NodeBB/NodeBB#1437 for more details
			*/
			if (pluginData.minver && !pluginData.compatibility) {
				pluginData.compatibility = '~' + pluginData.minver;
			}
			// End backwards compatibility block (#1437)

			if (pluginData.compatibility && semver.validRange(pluginData.compatibility)) {
				if (semver.ltr(pkg.version, pluginData.compatibility)) {
					// NodeBB may not be new enough to run this plugin
					process.stdout.write('\n');
					winston.warn('[plugins/' + pluginData.id + '] This plugin may not be compatible with your version of NodeBB. This may cause unintended behaviour or crashing.');
					winston.warn('[plugins/' + pluginData.id + '] In the event of an unresponsive NodeBB caused by this plugin, run ./nodebb reset plugin="' + pluginData.id + '".');
					process.stdout.write('\n');
				}
			}

			async.parallel([
				function(next) {
					if (pluginData.library) {
						libraryPath = path.join(pluginPath, pluginData.library);

						fs.exists(libraryPath, function(exists) {
							if (exists) {
								if (!Plugins.libraries[pluginData.id]) {
									Plugins.libraries[pluginData.id] = require(libraryPath);
								}

								// Register hooks for this plugin
								if (pluginData.hooks && Array.isArray(pluginData.hooks) && pluginData.hooks.length > 0) {
									async.each(pluginData.hooks, function(hook, next) {
										Plugins.registerHook(pluginData.id, hook, next);
									}, next);
								} else {
									next(null);
								}
							} else {
								winston.warn('[plugins.reload] Library not found for plugin: ' + pluginData.id);
								next();
							}
						});
					} else {
						winston.warn('[plugins.reload] Library not found for plugin: ' + pluginData.id);
						next();
					}
				},
				function(next) {
					// Static Directories for Plugins
					var	realPath,
						validMappedPath = /^[\w\-_]+$/;

					pluginData.staticDirs = pluginData.staticDirs || {};

					// Deprecated, to be removed v0.5
					if (pluginData.staticDir) {
						winston.warn('[plugins/' + pluginData.id + '] staticDir is deprecated, use staticDirs instead');
						Plugins.staticDirs[pluginData.id] = path.join(pluginPath, pluginData.staticDir);
					}

					function mapStaticDirs(mappedPath) {
						if (Plugins.staticDirs[mappedPath]) {
							winston.warn('[plugins/' + pluginData.id + '] Mapped path (' + mappedPath + ') already specified!');
						} else if (!validMappedPath.test(mappedPath)) {
							winston.warn('[plugins/' + pluginData.id + '] Invalid mapped path specified: ' + mappedPath + '. Path must adhere to: ' + validMappedPath.toString());
						} else {
							realPath = pluginData.staticDirs[mappedPath];
							staticDir = path.join(pluginPath, realPath);

							(function(staticDir) {
								fs.exists(staticDir, function(exists) {
									if (exists) {
										Plugins.staticDirs[pluginData.id + '/' + mappedPath] = staticDir;
									} else {
										winston.warn('[plugins/' + pluginData.id + '] Mapped path \'' + mappedPath + ' => ' + staticDir + '\' not found.');
									}
								});
							}(staticDir));
						}
					}

					for(var key in pluginData.staticDirs) {
						if (pluginData.staticDirs.hasOwnProperty(key)) {
							mapStaticDirs(key);
						}
					}

					next();
				},
				function(next) {
					// CSS Files for plugins
					if (pluginData.css && pluginData.css instanceof Array) {
						if (global.env === 'development') {
							winston.info('[plugins] Found ' + pluginData.css.length + ' CSS file(s) for plugin ' + pluginData.id);
						}

						Plugins.cssFiles = Plugins.cssFiles.concat(pluginData.css.map(function(file) {
							return path.join(pluginData.id, file);
						}));
					}

					next();
				},
				function(next) {
					// LESS files for plugins
					if (pluginData.less && pluginData.less instanceof Array) {
						if (global.env === 'development') {
							winston.info('[plugins] Found ' + pluginData.less.length + ' LESS file(s) for plugin ' + pluginData.id);
						}

						Plugins.lessFiles = Plugins.lessFiles.concat(pluginData.less.map(function(file) {
							return path.join(pluginData.id, file);
						}));
					}

					next();
				},
				function(next) {
					// Client-side scripts
					if (pluginData.scripts && pluginData.scripts instanceof Array) {
						if (global.env === 'development') {
							winston.info('[plugins] Found ' + pluginData.scripts.length + ' js file(s) for plugin ' + pluginData.id);
						}

						Plugins.clientScripts = Plugins.clientScripts.concat(pluginData.scripts.map(function(file) {
							return path.join(__dirname, '../node_modules/', pluginData.id, file);
						}));
					}

					next();
				},
				function(next) {
					if (pluginData.languages && typeof pluginData.languages === 'string') {
						var pathToFolder = path.join(__dirname, '../node_modules/', pluginData.id, pluginData.languages);

						utils.walk(pathToFolder, function(err, languages) {
							var arr = [];

							async.each(languages, function(pathToLang, next) {
								fs.readFile(pathToLang, function(err, file) {
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

									next(err);
								});
							}, function(err) {
								Plugins.customLanguages = Plugins.customLanguages.concat(arr);
								next(err);
							});
						});
					} else {
						next();
					}
				}
			], function(err) {
				if (!err) {
					if (global.env === 'development') {
						winston.info('[plugins] Loaded plugin: ' + pluginData.id);
					}
					callback();
				} else {
					callback(new Error('Could not load plugin system'));
				}
			});
		});
	};

	Plugins.registerHook = function(id, data, callback) {
		/*
			`data` is an object consisting of (* is required):
				`data.hook`*, the name of the NodeBB hook
				`data.method`*, the method called in that plugin
				`data.priority`, the relative priority of the method when it is eventually called (default: 10)
		*/

		var method;

		if (data.hook && data.method) {
			data.id = id;
			if (!data.priority) {
				data.priority = 10;
			}

			if (typeof data.method === 'string' && data.method.length > 0) {
				method = data.method.split('.').reduce(function(memo, prop) {
					if (memo !== null && memo[prop]) {
						return memo[prop];
					} else {
						// Couldn't find method by path, aborting
						return null;
					}
				}, Plugins.libraries[data.id]);

				// Write the actual method reference to the hookObj
				data.method = method;

				register();
			} else if (typeof data.method === 'function') {
				register();
			} else {
				winston.warn('[plugins/' + id + '] Hook method mismatch: ' + data.hook + ' => ' + data.method);
			}
		}

		function register() {
			Plugins.loadedHooks[data.hook] = Plugins.loadedHooks[data.hook] || [];
			Plugins.loadedHooks[data.hook].push(data);

			if (typeof callback === 'function') {
				callback();
			}
		}
	};

	Plugins.hasListeners = function(hook) {
		return !!(Plugins.loadedHooks[hook] && Plugins.loadedHooks[hook].length > 0);
	};

	Plugins.fireHook = function(hook) {
		var callback = typeof arguments[arguments.length-1] === 'function' ? arguments[arguments.length-1] : null,
			args = arguments.length ? Array.prototype.slice.call(arguments, 1) : [];

		if (callback) {
			args.pop();
		}

		var hookList = Plugins.loadedHooks[hook];

		if (Array.isArray(hookList)) {
			// if (global.env === 'development') winston.info('[plugins] Firing hook: \'' + hook + '\'');
			var hookType = hook.split(':')[0];
			switch (hookType) {
				case 'filter':
					async.reduce(hookList, args, function(value, hookObj, next) {
						if (hookObj.method) {
							if (!hookObj.hasOwnProperty('callbacked') || hookObj.callbacked === true) {
								// omg, after 6 months I finally realised what this does...
								// It adds the callback to the arguments passed-in, since the callback
								// is defined in *this* file (the async cb), and not the hooks themselves.
								value = hookObj.method.apply(Plugins, value.concat(function() {
									next(arguments[0], Array.prototype.slice.call(arguments, 1));
								}));

								/*
									Backwards compatibility block for v0.5.0
									Remove this once NodeBB enters v0.5.0-1
								*/
								if (value !== undefined && value !== callback) {
									winston.warn('[plugins/' + hookObj.id + '] "callbacked" deprecated as of 0.4x. Use asynchronous method instead for hook: ' + hook);
									next(null, [value]);
								}
							} else {
								winston.warn('[plugins/' + hookObj.id + '] "callbacked" deprecated as of 0.4x. Use asynchronous method instead for hook: ' + hook);
								value = hookObj.method.apply(Plugins, value);
								next(null, [value]);
							}
							/* End backwards compatibility block */
						} else {
							if (global.env === 'development') {
								winston.info('[plugins] Expected method for hook \'' + hook + '\' in plugin \'' + hookObj.id + '\' not found, skipping.');
							}
							next(null, [value]);
						}
					}, function(err, values) {
						if (err) {
							if (global.env === 'development') {
								winston.info('[plugins] Problem executing hook: ' + hook + ' err: ' + JSON.stringify(err));
							}
						}

						if (callback) {
							callback.apply(Plugins, [err].concat(values));
						}
					});
					break;
				case 'action':
					var deprecationWarn = [];
					async.each(hookList, function(hookObj, next) {
						/*
							Backwards compatibility block for v0.5.0
							Remove this once NodeBB enters v0.6.0-1
						*/
						if (hook === 'action:app.load') {
							deprecationWarn.push(hookObj.id);
						}
						/* End backwards compatibility block */

						if (hookObj.method) {
							hookObj.method.apply(Plugins, args);
						} else {
							if (global.env === 'development') {
								winston.info('[plugins] Expected method \'' + hookObj.method + '\' in plugin \'' + hookObj.id + '\' not found, skipping.');
							}
						}

						next();
					}, function() {
						/*
							Backwards compatibility block for v0.5.0
							Remove this once NodeBB enters v0.6.0-1
						*/
						if (deprecationWarn.length) {
							winston.warn('[plugins] The `action:app.load` hook is deprecated in favour of `static:app.load`, please notify the developers of the following plugins:');
							for(var x=0,numDeprec=deprecationWarn.length;x<numDeprec;x++) {
								process.stdout.write('  * ' + deprecationWarn[x] + '\n');
							}
						}
						/* End backwards compatibility block */
					});
					break;
				case 'static':
					async.each(hookList, function(hookObj, next) {
						if (hookObj.method) {
							hookObj.method.apply(Plugins, args.concat(next));
						}
					}, function(err) {
						callback(err);
					});
					break;
				default:
					// Do nothing...
					break;
			}
		} else {
			// Otherwise, this hook contains no methods
			if (callback) {
				callback.apply(this, [null].concat(args));
			}

			return args[0];
		}
	};

	Plugins.isActive = function(id, callback) {
		db.isSetMember('plugins:active', id, callback);
	};

	Plugins.toggleActive = function(id, callback) {
		Plugins.isActive(id, function(err, active) {
			if (err) {
				if (global.env === 'development') {
					winston.info('[plugins] Could not toggle active state on plugin \'' + id + '\'');
				}
				return callback(err);
			}

			db[(active ? 'setRemove' : 'setAdd')]('plugins:active', id, function(err, success) {
				if (err) {
					if (global.env === 'development') {
						winston.info('[plugins] Could not toggle active state on plugin \'' + id + '\'');
					}
					return callback(err);
				}

				meta.restartRequired = true;

				if (active) {
					Plugins.fireHook('action:plugin.deactivate', id);
				}

				// Reload meta data
				Plugins.reload(function() {
					if(!active) {
						Plugins.fireHook('action:plugin.activate', id);
					}

					if (typeof callback === 'function') {
						callback(null, {
							id: id,
							active: !active
						});
					}
				});
			});
		});
	};

	Plugins.toggleInstall = function(id, callback) {
		Plugins.isInstalled(id, function(err, installed) {
			if (err) {
				return callback(err);
			}

			var npm = require('npm');

			async.waterfall([
				function(next) {
					Plugins.isActive(id, next);
				},
				function(active, next) {
					if (active) {
						Plugins.toggleActive(id, function(err, status) {
							next(err);
						});
						return;
					}
					next();
				},
				function(next) {
					npm.load({}, next);
				},
				function(res, next) {
					npm.commands[installed ? 'uninstall' : 'install'](installed ? id : [id], next);
				}
			], function(err) {
				callback(err, {
					id: id,
					installed: !installed
				});
			});
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

						next(err);
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
		request('http://npm.aws.af.cm/api/v1/plugins', function(err, res, body) {
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
				plugins[i].url = plugins[i].repository ? plugins[i].repository.url : '';
				pluginMap[plugins[i].name] = plugins[i];
			}

			Plugins.showInstalled(function(err, installedPlugins) {
				if (err) {
					return callback(err);
				}

				async.each(installedPlugins, function(plugin, next) {

					pluginMap[plugin.id] = pluginMap[plugin.id] || {};
					pluginMap[plugin.id].id = pluginMap[plugin.id].id || plugin.id;
					pluginMap[plugin.id].name = pluginMap[plugin.id].name || plugin.id;
					pluginMap[plugin.id].description = plugin.description;
					pluginMap[plugin.id].url = pluginMap[plugin.id].url || plugin.url;
					pluginMap[plugin.id].installed = true;

					Plugins.isActive(plugin.id, function(err, active) {
						if (err) {
							return next(err);
						}

						pluginMap[plugin.id].active = active;
						next();
					});
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
						if(a.installed && !b.installed) {
							return -1;
						} else if(!a.installed && b.installed) {
							return 1;
						}
						return 0;
					});

					callback(null, pluginArray);
				});
			});
		});
	};

	Plugins.isInstalled = function(id, callback) {
		var pluginDir = path.join(__dirname, '../node_modules', id);

		fs.stat(pluginDir, function(err, stats) {
			callback(null, err ? false : stats.isDirectory());
		});
	};

	Plugins.showInstalled = function(callback) {
		var npmPluginPath = path.join(__dirname, '../node_modules');

		async.waterfall([
			async.apply(fs.readdir, npmPluginPath),

			function(dirs, next) {
				dirs = dirs.filter(function(dir){
					return dir.substr(0, 14) === 'nodebb-plugin-' || dir.substr(0, 14) === 'nodebb-widget-';
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
							fs.readFile(path.join(file, 'plugin.json'), next);
						},
						function(configJSON, next) {
							var config;

							try {
								config = JSON.parse(configJSON);
							} catch (err) {
								winston.warn("Plugin: " + file + " is corrupted or invalid. Please check plugin.json for errors.");
								return next(err, null);
							}

							Plugins.isActive(config.id, function(err, active) {
								if (err) {
									next(new Error('no-active-state'));
								}

								delete config.library;
								delete config.hooks;
								config.active = active;
								config.installed = true;

								next(null, config);
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
		], function(err, plugins) {
			callback(err, plugins);
		});
	};



	function addLanguages(router, middleware, controllers, callback) {
		Plugins.customLanguages.forEach(function(lang) {
			router.get('/language' + lang.route, function(req, res, next) {
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
