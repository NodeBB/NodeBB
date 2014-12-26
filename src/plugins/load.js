'use strict';

var fs = require('fs'),
	path = require('path'),
	semver = require('semver'),
	async = require('async'),
	winston = require('winston'),
	pkg = require('../../package.json'),
	utils = require('../../public/src/utils');


module.exports = function(Plugins) {

	Plugins.loadPlugin = function(pluginPath, callback) {
		fs.readFile(path.join(pluginPath, 'plugin.json'), function(err, data) {
			if (err) {
				return callback(pluginPath.match('nodebb-theme') ? null : err);
			}

			var pluginData, staticDir;

			try {
				pluginData = JSON.parse(data);
			} catch (err) {
				var pluginDir = pluginPath.split(path.sep);
				pluginDir = pluginDir[pluginDir.length -1];

				winston.error('[plugins/' + pluginDir + '] Plugin not loaded - please check its plugin.json for errors');
				return callback();
			}

			if (pluginData.compatibility && semver.validRange(pluginData.compatibility)) {
				if (!semver.gtr(pkg.version, pluginData.compatibility)) {
					// NodeBB may not be new enough to run this plugin
					process.stdout.write('\n');
					winston.warn('[plugins/' + pluginData.id + '] This plugin may not be compatible with your version of NodeBB. This may cause unintended behaviour or crashing.');
					winston.warn('[plugins/' + pluginData.id + '] In the event of an unresponsive NodeBB caused by this plugin, run ./nodebb reset plugin="' + pluginData.id + '".');
					process.stdout.write('\n');
				}
			}

			async.parallel([
				function(next) {
					registerHooks(pluginData, pluginPath, next);
				},
				function(next) {
					mapStaticDirectories(pluginData, pluginPath, next);
				},
				function(next) {
					mapCssFiles(pluginData, next);
				},
				function(next) {
					mapLessFiles(pluginData, next);
				},
				function(next) {
					mapClientSideScripts(pluginData, next);
				},
				function(next) {
					loadLanguages(pluginData, next);
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

	function registerHooks(pluginData, pluginPath, callback) {
		function libraryNotFound() {
			winston.warn('[plugins.reload] Library not found for plugin: ' + pluginData.id);
			callback();
		}

		if (!pluginData.library) {
			return libraryNotFound();
		}

		var libraryPath = path.join(pluginPath, pluginData.library);

		fs.exists(libraryPath, function(exists) {
			if (!exists) {
				return libraryNotFound();
			}

			if (!Plugins.libraries[pluginData.id]) {
				Plugins.requireLibrary(pluginData, libraryPath);
			}

			if (Array.isArray(pluginData.hooks) && pluginData.hooks.length > 0) {
				async.each(pluginData.hooks, function(hook, next) {
					Plugins.registerHook(pluginData.id, hook, next);
				}, callback);
			} else {
				callback();
			}
		});
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

				fs.exists(staticDir, function(exists) {
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

	function mapCssFiles(pluginData, callback) {
		if (Array.isArray(pluginData.css)) {
			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + pluginData.css.length + ' CSS file(s) for plugin ' + pluginData.id);
			}

			Plugins.cssFiles = Plugins.cssFiles.concat(pluginData.css.map(function(file) {
				return path.join(pluginData.id, file);
			}));
		}

		callback();
	}

	function mapLessFiles(pluginData, callback) {
		if (Array.isArray(pluginData.less)) {
			if (global.env === 'development') {
				winston.verbose('[plugins] Found ' + pluginData.less.length + ' LESS file(s) for plugin ' + pluginData.id);
			}

			Plugins.lessFiles = Plugins.lessFiles.concat(pluginData.less.map(function(file) {
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

		callback();
	}

	function loadLanguages(pluginData, callback) {
		if (typeof pluginData.languages !== 'string') {
			return callback();
		}

		var pathToFolder = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages);

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

					next();
				});
			}, function(err) {
				if (err) {
					return callback(err);
				}
				Plugins.customLanguages = Plugins.customLanguages.concat(arr);
				callback();
			});
		});

	}

};