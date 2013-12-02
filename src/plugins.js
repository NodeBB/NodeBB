var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	winston = require('winston'),
	eventEmitter = require('events').EventEmitter,
	db = require('./database'),

	plugins = {
		libraries: {},
		loadedHooks: {},
		staticDirs: {},
		cssFiles: [],

		// Events
		readyEvent: new eventEmitter,

		init: function() {
			if (this.initialized) return;
			if (global.env === 'development') winston.info('[plugins] Initializing plugins system');

			this.reload(function(err) {
				if (err) {
					if (global.env === 'development') winston.info('[plugins] NodeBB encountered a problem while loading plugins', err.message);
					return;
				}

				if (global.env === 'development') winston.info('[plugins] Plugins OK');

				plugins.initialized = true;
				plugins.readyEvent.emit('ready');
			});
		},
		ready: function(callback) {
			if (!this.initialized) this.readyEvent.once('ready', callback);
			else callback();
		},
		initialized: false,
		reload: function(callback) {
			var _self = this;

			// Resetting all local plugin data
			this.loadedHooks = {};
			this.staticDirs = {};
			this.cssFiles.length = 0;

			// Read the list of activated plugins and require their libraries
			async.waterfall([
				function(next) {
					db.getSetMembers('plugins:active', next);
				},
				function(plugins, next) {
					if (plugins && Array.isArray(plugins) && plugins.length > 0) {
						async.each(plugins, function(plugin, next) {
							var modulePath = path.join(__dirname, '../node_modules/', plugin);
							if (fs.existsSync(modulePath)) _self.loadPlugin(modulePath, next);
							else {
								if (global.env === 'development') winston.warn('[plugins] Plugin \'' + plugin + '\' not found');
								next(); // Ignore this plugin silently
							}
						}, next);
					} else next();
				},
				function(next) {
					if (global.env === 'development') winston.info('[plugins] Sorting hooks to fire in priority sequence');
					Object.keys(_self.loadedHooks).forEach(function(hook) {
						var hooks = _self.loadedHooks[hook];
						hooks = hooks.sort(function(a, b) {
							return a.priority - b.priority;
						});
					});

					next();
				}
			], callback);
		},
		loadPlugin: function(pluginPath, callback) {
			var _self = this;

			fs.readFile(path.join(pluginPath, 'plugin.json'), function(err, data) {
				if (err) return callback(err);

				var pluginData = JSON.parse(data),
					libraryPath, staticDir;

				async.parallel([
					function(next) {
						if (pluginData.library) {
							libraryPath = path.join(pluginPath, pluginData.library);

							fs.exists(libraryPath, function(exists) {
								if (exists) {
									if (!_self.libraries[pluginData.id]) {
										_self.libraries[pluginData.id] = require(libraryPath);
									}

									// Register hooks for this plugin
									if (pluginData.hooks && Array.isArray(pluginData.hooks) && pluginData.hooks.length > 0) {
										async.each(pluginData.hooks, function(hook, next) {
											_self.registerHook(pluginData.id, hook, next);
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
									_self.staticDirs[pluginData.id] = staticDir;
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

							_self.cssFiles = _self.cssFiles.concat(pluginData.css.map(function(file) {
								return path.join('/plugins', pluginData.id, file);
							}));

							next();
						} else next();
					}
				], function(err) {
					if (!err) {
						if (global.env === 'development') winston.info('[plugins] Loaded plugin: ' + pluginData.id);
						callback();
					} else callback(new Error('Could not load plugin system'))
				});
			});
		},
		registerHook: function(id, data, callback) {
			/*
				`data` is an object consisting of (* is required):
					`data.hook`*, the name of the NodeBB hook
					`data.method`*, the method called in that plugin
					`data.callbacked`, whether or not the hook expects a callback (true), or a return (false). Only used for filters. (Default: false)
					`data.priority`, the relative priority of the method when it is eventually called (default: 10)
			*/
			var _self = this;

			if (data.hook && data.method) {
				data.id = id;
				if (!data.priority) data.priority = 10;
				data.method = data.method.split('.').reduce(function(memo, prop) {
					if (memo[prop]) {
						return memo[prop];
					} else {
						// Couldn't find method by path, assuming property with periods in it (evil!)
						_self.libraries[data.id][data.method];
					}
				}, _self.libraries[data.id]);

				_self.loadedHooks[data.hook] = _self.loadedHooks[data.hook] || [];
				_self.loadedHooks[data.hook].push(data);

				if (global.env === 'development') winston.info('[plugins] Hook registered: ' + data.hook + ' will call ' + id);
				callback();
			} else return;
		},
		fireHook: function(hook, args, callback) {
			var _self = this
			hookList = this.loadedHooks[hook];

			if (hookList && Array.isArray(hookList)) {
				//if (global.env === 'development') winston.info('[plugins] Firing hook: \'' + hook + '\'');
				var hookType = hook.split(':')[0];
				switch (hookType) {
					case 'filter':
						async.reduce(hookList, args, function(value, hookObj, next) {
							if (hookObj.method) {
								if (hookObj.callbacked) {	// If a callback is present (asynchronous method)
									hookObj.method.call(_self.libraries[hookObj.id], value, next);
								} else {	// Synchronous method
									value = hookObj.method.call(_self.libraries[hookObj.id], value);
									next(null, value);
								}
							} else {
								if (global.env === 'development') winston.info('[plugins] Expected method \'' + hookObj.method + '\' in plugin \'' + hookObj.id + '\' not found, skipping.');
								next(null, value);
							}
						}, function(err, value) {
							if (err) {
								if (global.env === 'development') {
									winston.info('[plugins] Problem executing hook: ' + hook);
								}
							}

							callback.apply(plugins, arguments);
						});
						break;
					case 'action':
						async.each(hookList, function(hookObj) {
							if (hookObj.method) {
								hookObj.method.call(_self.libraries[hookObj.id], args);
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
		},
		isActive: function(id, callback) {
			db.isSetMember('plugins:active', id, callback);
		},
		toggleActive: function(id, callback) {
			this.isActive(id, function(err, active) {
				if (err) {
					if (global.env === 'development') winston.info('[plugins] Could not toggle active state on plugin \'' + id + '\'');
					return;
				}

				db[(active ? 'setRemove' : 'setAdd')]('plugins:active', id, function(err, success) {
					if (err) {
						if (global.env === 'development') winston.info('[plugins] Could not toggle active state on plugin \'' + id + '\'');
						return;
					}

					// Reload meta data
					plugins.reload(function() {
						// (De)activation Hooks
						plugins.fireHook('action:plugin.' + (active ? 'de' : '') + 'activate', id);

						if (callback) {
							callback({
								id: id,
								active: !active
							});
						}
					});
				});
			});
		},
		showInstalled: function(callback) {
			var _self = this;
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

								_self.isActive(config.id, function(err, active) {
									if (err) next(new Error('no-active-state'));

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
	}

plugins.init();

module.exports = plugins;