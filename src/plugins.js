var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	winston = require('winston'),
	eventEmitter = require('events').EventEmitter,
	db = require('./database');

(function(Plugins) {

	Plugins.libraries = {};
	Plugins.loadedHooks = {};
	Plugins.staticDirs = {};
	Plugins.cssFiles = [];

	Plugins.initialized = false;

	// Events
	Plugins.readyEvent = new eventEmitter;

	Plugins.init = function() {
		if (Plugins.initialized) {
			return;
		}

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
			Plugins.readyEvent.emit('ready');
		});
	};

	Plugins.ready = function(callback) {
		if (!Plugins.initialized) {
			Plugins.readyEvent.once('ready', callback);
		} else {
			callback();
		}
	};

	Plugins.reload = function(callback) {
		// Resetting all local plugin data
		Plugins.loadedHooks = {};
		Plugins.staticDirs = {};
		Plugins.cssFiles.length = 0;

		// Read the list of activated plugins and require their libraries
		async.waterfall([
			function(next) {
				db.getSetMembers('plugins:active', next);
			},
			function(plugins, next) {
				if (plugins && Array.isArray(plugins) && plugins.length > 0) {
					async.each(plugins, function(plugin, next) {
						var modulePath = path.join(__dirname, '../node_modules/', plugin);
						if (fs.existsSync(modulePath)) {
							Plugins.loadPlugin(modulePath, next);
						} else {
							if (global.env === 'development') {
								winston.warn('[plugins] Plugin \'' + plugin + '\' not found');
							}
							next(); // Ignore this plugin silently
						}
					}, next);
				} else next();
			},
			function(next) {
				if (global.env === 'development') winston.info('[plugins] Sorting hooks to fire in priority sequence');
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

	Plugins.loadPlugin = function(pluginPath, callback) {
		fs.readFile(path.join(pluginPath, 'plugin.json'), function(err, data) {
			if (err) {
				return callback(err);
			}

			var pluginData = JSON.parse(data),
				libraryPath, staticDir;

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
					if (pluginData.staticDir) {
						staticDir = path.join(pluginPath, pluginData.staticDir);

						fs.exists(staticDir, function(exists) {
							if (exists) {
								Plugins.staticDirs[pluginData.id] = staticDir;
								next();
							} else next();
						});
					} else next();
				},
				function(next) {
					// CSS Files for plugins
					if (pluginData.css && pluginData.css instanceof Array) {
						if (global.env === 'development') {
							winston.info('[plugins] Found ' + pluginData.css.length + ' CSS file(s) for plugin ' + pluginData.id);
						}

						Plugins.cssFiles = Plugins.cssFiles.concat(pluginData.css.map(function(file) {
							return path.join('/plugins', pluginData.id, file);
						}));

						next();
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
				`data.callbacked`, whether or not the hook expects a callback (true), or a return (false). Only used for filters. (Default: false)
				`data.priority`, the relative priority of the method when it is eventually called (default: 10)
		*/

		if (data.hook && data.method) {
			data.id = id;
			if (!data.priority) data.priority = 10;
			data.method = data.method.split('.').reduce(function(memo, prop) {
				if (memo[prop]) {
					return memo[prop];
				} else {
					// Couldn't find method by path, assuming property with periods in it (evil!)
					Plugins.libraries[data.id][data.method];
				}
			}, Plugins.libraries[data.id]);

			Plugins.loadedHooks[data.hook] = Plugins.loadedHooks[data.hook] || [];
			Plugins.loadedHooks[data.hook].push(data);

			if (global.env === 'development') {
				winston.info('[plugins] Hook registered: ' + data.hook + ' will call ' + id);
			}
			callback();
		} else return;
	};

	Plugins.fireHook = function(hook, args, callback) {
		hookList = Plugins.loadedHooks[hook];

		if (hookList && Array.isArray(hookList)) {
			//if (global.env === 'development') winston.info('[plugins] Firing hook: \'' + hook + '\'');
			var hookType = hook.split(':')[0];
			switch (hookType) {
				case 'filter':
					async.reduce(hookList, args, function(value, hookObj, next) {
						if (hookObj.method) {
							if (hookObj.callbacked) {	// If a callback is present (asynchronous method)
								hookObj.method.call(Plugins.libraries[hookObj.id], value, next);
							} else {	// Synchronous method
								value = hookObj.method.call(Plugins.libraries[hookObj.id], value);
								next(null, value);
							}
						} else {
							if (global.env === 'development') {
								winston.info('[plugins] Expected method \'' + hookObj.method + '\' in plugin \'' + hookObj.id + '\' not found, skipping.');
							}
							next(null, value);
						}
					}, function(err, value) {
						if (err) {
							if (global.env === 'development') {
								winston.info('[plugins] Problem executing hook: ' + hook);
							}
						}

						callback.apply(Plugins, arguments);
					});
					break;
				case 'action':
					async.each(hookList, function(hookObj) {
						if (hookObj.method) {
							hookObj.method.call(Plugins.libraries[hookObj.id], args);
						} else {
							if (global.env === 'development') {
								winston.info('[plugins] Expected method \'' + hookObj.method + '\' in plugin \'' + hookObj.id + '\' not found, skipping.');
							}
						}
					});
					break;
				default:
					// Do nothing...
					break;
			}
		} else {
			// Otherwise, this hook contains no methods
			var returnVal = args;
			if (callback) {
				callback(null, returnVal);
			}
		}
	};

	Plugins.isActive = function(id, callback) {
		db.isSetMember('plugins:active', id, callback);
	};

	Plugins.toggleActive = function(id, callback) {
		Plugins.isActive(id, function(err, active) {
			if (err) {
				if (global.env === 'development') winston.info('[plugins] Could not toggle active state on plugin \'' + id + '\'');
				return;
			}

			db[(active ? 'setRemove' : 'setAdd')]('plugins:active', id, function(err, success) {
				if (err) {
					if (global.env === 'development') winston.info('[plugins] Could not toggle active state on plugin \'' + id + '\'');
					return;
				}


				if(active) {
					Plugins.fireHook('action:plugin.deactivate', id);
				}

				// Reload meta data
				Plugins.reload(function() {

					if(!active) {
						Plugins.fireHook('action:plugin.activate', id);
					}

					if (callback) {
						callback({
							id: id,
							active: !active
						});
					}
				});
			});
		});
	}

	Plugins.showInstalled = function(callback) {
		npmPluginPath = path.join(__dirname, '../node_modules');

		async.waterfall([
			function(next) {
				fs.readdir(npmPluginPath, function(err, dirs) {
					dirs = dirs.map(function(file) {
						return path.join(npmPluginPath, file);
					}).filter(function(file) {
						var stats = fs.statSync(file);
						if (stats.isDirectory() && file.substr(npmPluginPath.length + 1, 14) === 'nodebb-plugin-') return true;
						else return false;
					});

					next(err, dirs);
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
							try {
								var config = JSON.parse(configJSON);
							} catch (err) {
								winston.warn("Plugin: " + file + " is corrupted or invalid. Please check plugin.json for errors.")
								return next(err, null);
							}

							Plugins.isActive(config.id, function(err, active) {
								if (err) {
									next(new Error('no-active-state'));
								}

								delete config.library;
								delete config.hooks;
								config.active = active;
								config.activeText = '<i class="fa fa-power-off"></i> ' + (active ? 'Dea' : 'A') + 'ctivate';
								next(null, config);
							});
						}
					], function(err, config) {
						if (err) return next(); // Silently fail

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
	}
}(exports));
