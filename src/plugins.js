var	fs = require('fs'),
	path = require('path'),
	RDB = require('./redis.js'),
	async = require('async'),
	plugins = {
		libraries: [],
		loadedHooks: {},
		init: function() {
			if (this.initialized) return;
			if (global.env === 'development') console.log('Info: [plugins] Initializing plugins system');

			var	_self = this;

			// Read the list of activated plugins and require their libraries
			async.waterfall([
				function(next) {
					RDB.smembers('plugins:active', next);
				},
				function(plugins, next) {
					async.each(plugins, function(plugin) {
						// TODO: Update this check to also check node_modules
						var	pluginPath = path.join(__dirname, '../plugins/', plugin);
						fs.exists(pluginPath, function(exists) {
							if (exists) {
								fs.readFile(path.join(pluginPath, 'plugin.json'), function(err, data) {
									if (err) return next(err);

									var	pluginData = JSON.parse(data);
									_self.libraries[pluginData.id] = require(path.join(pluginPath, pluginData.library));
									if (pluginData.hooks) {
										for(var x=0,numHooks=pluginData.hooks.length;x<numHooks;x++) {
											_self.registerHook(pluginData.id, pluginData.hooks[x]);
										}
									}
									if (global.env === 'development') console.log('Info: [plugins] Loaded plugin: ' + pluginData.id);

									next();
								});
							} else {
								if (global.env === 'development') console.log('Info: [plugins] Plugin \'' + plugin + '\' not found');
								next();	// Ignore this plugin silently
							}
						})
					}, next);
				}
			], function(err) {
				if (err) {
					if (global.env === 'development') console.log('Info: [plugins] NodeBB encountered a problem while loading plugins', err.message);
					return;
				}

				if (global.env === 'development') console.log('Info: [plugins] Plugins OK');
			});
		},
		initialized: false,
		registerHook: function(id, data) {
			/*
				`data` is an object consisting of (* is required):
					`data.hook`*, the name of the NodeBB hook
					`data.method`*, the method called in that plugin
					`data.callbacked`, whether or not the hook expects a callback (true), or a return (false). Only used for filters. (Default: false)
					(Not implemented) `data.priority`, the relative priority of the method when it is eventually called (default: 10)
			*/
			var	_self = this;

			if (data.hook && data.method) {
				_self.loadedHooks[data.hook] = _self.loadedHooks[data.hook] || [];
				_self.loadedHooks[data.hook].push([id, data.method]);
				if (global.env === 'development') console.log('Info: [plugins] Hook registered: ' + data.hook + ' will call ' + id);
			} else return;
		},
		fireHook: function(hook, args, callback) {
			// TODO: Implement priority hook firing
			var	_self = this
				hookList = this.loadedHooks[hook];

			if (hookList && Array.isArray(hookList)) {
				if (global.env === 'development') console.log('Info: [plugins] Firing hook: \'' + hook + '\'');
				var	hookType = hook.split(':')[0];
				switch(hookType) {
					case 'filter':
						// Filters only take one argument, so only args[0] will be passed in
						var	returnVal = (Array.isArray(args) ? args[0] : args);

						async.each(hookList, function(hookObj, next) {
							if (hookObj.callbacked) {
								_self.libraries[hookObj[0]][hookObj[1]](returnVal, function(err, afterVal) {
									returnVal = afterVal;
									next(err);
								});
							} else {
								returnVal = _self.libraries[hookObj[0]][hookObj[1]](returnVal);
								next();
							}
						}, function(err) {
							if (err) {
								if (global.env === 'development') console.log('Info: [plugins] Problem executing hook: ' + hook);
							}

							callback(returnVal);
						});
					break;
					case 'action':
						async.each(hookList, function(hookObj) {
							_self.libraries[hookObj[0]][hookObj[1]].apply(_self.libraries[hookObj[0]], args);
						});
					break;
					default:
						// Do nothing...
					break;
				}
			} else {
				// Otherwise, this hook contains no methods
				var	returnVal = (Array.isArray(args) ? args[0] : args);
				if (callback) callback(returnVal);
			}
		},
		showInstalled: function() {
			// TODO: Also check /node_modules
			var	moduleBasePath = path.join(__dirname, '../plugins');

			async.waterfall([
				function(next) {
					fs.readdir(moduleBasePath, next);
				},
				function(files, next) {
					var	plugins = [];

					async.each(files, function(file, next) {
						var	modulePath = path.join(moduleBasePath, file),
							configPath;

						fs.stat(path.join(moduleBasePath, file), function(err, stats) {
							if (err || !stats.isDirectory()) return next();	//Silently fail

							// Load the config file
							fs.readFile(path.join(modulePath, 'plugin.json'), function(err, configJSON) {
								if (err) return next();	// Silently fail if config can't be read
								var	config = JSON.parse(configJSON);
								delete config.library;
								delete config.hooks;

								plugins.push(config);
								next();
							});
						});
					}, function(err) {
						next(null, plugins);
					});
				}
			], function(err, plugins) {
				console.log('plugins:', plugins);
			});
		}
	}

plugins.init();

module.exports = plugins;