'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var winston = require('winston');

var db = require('../database');
var file = require('../file');

var Data = module.exports;

var basePath = path.join(__dirname, '../../');

function getPluginPaths(callback) {
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
}
Data.getPluginPaths = getPluginPaths;

function loadPluginInfo(pluginPath, callback) {
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
			var pluginDir = path.basename(pluginPath);

			winston.error('[plugins/' + pluginDir + '] Error in plugin.json or package.json! ' + err.message);
			return callback(new Error('[[error:parse-error]]'));
		}

		callback(null, pluginData);
	});
}
Data.loadPluginInfo = loadPluginInfo;

function getAllPluginData(callback) {
	async.waterfall([
		function (next) {
			getPluginPaths(next);
		},
		function (pluginPaths, next) {
			async.map(pluginPaths, loadPluginInfo, next);
		},
	], callback);
}
Data.getActive = getAllPluginData;

function getStaticDirectories(pluginData, callback) {
	var validMappedPath = /^[\w\-_]+$/;

	if (!pluginData.staticDirs) {
		return callback();
	}

	var dirs = Object.keys(pluginData.staticDirs);
	if (!dirs.length) {
		return callback();
	}

	var staticDirs = {};

	async.each(dirs, function (route, next) {
		if (!validMappedPath.test(route)) {
			winston.warn('[plugins/' + pluginData.id + '] Invalid mapped path specified: ' +
				route + '. Path must adhere to: ' + validMappedPath.toString());
			return next();
		}

		var dirPath = path.join(pluginData.path, pluginData.staticDirs[route]);
		fs.stat(dirPath, function (err, stats) {
			if (err && err.code === 'ENOENT') {
				winston.warn('[plugins/' + pluginData.id + '] Mapped path \'' +
					route + ' => ' + dirPath + '\' not found.');
				return next();
			}
			if (err) {
				return next(err);
			}

			if (!stats.isDirectory()) {
				winston.warn('[plugins/' + pluginData.id + '] Mapped path \'' +
					route + ' => ' + dirPath + '\' is not a directory.');
				return next();
			}

			staticDirs[pluginData.id + '/' + route] = dirPath;
			next();
		});
	}, function (err) {
		callback(err, staticDirs);
	});
}
Data.getStaticDirectories = getStaticDirectories;

function getFiles(pluginData, type, callback) {
	if (!Array.isArray(pluginData[type]) || !pluginData[type].length) {
		return callback();
	}

	if (global.env === 'development') {
		winston.verbose('[plugins] Found ' + pluginData[type].length + ' ' + type + ' file(s) for plugin ' + pluginData.id);
	}

	var files = pluginData[type].map(function (file) {
		return path.join(pluginData.id, file);
	});

	callback(null, files);
}
Data.getFiles = getFiles;

/**
 * With npm@3, dependencies can become flattened, and appear at the root level.
 * This method resolves these differences if it can.
 */
function resolveModulePath(basePath, modulePath, callback) {
	var isNodeModule = /node_modules/;

	var currentPath = path.join(basePath, modulePath);
	file.exists(currentPath, function (err, exists) {
		if (err) {
			return callback(err);
		}
		if (exists) {
			return callback(null, currentPath);
		}
		if (!isNodeModule.test(modulePath)) {
			winston.warn('[plugins] File not found: ' + currentPath + ' (Ignoring)');
			return callback();
		}

		var dirPath = path.dirname(basePath);
		if (dirPath === basePath) {
			winston.warn('[plugins] File not found: ' + currentPath + ' (Ignoring)');
			return callback();
		}

		resolveModulePath(dirPath, modulePath, callback);
	});
}

function getScripts(pluginData, target, callback) {
	target = (target === 'client') ? 'scripts' : 'acpScripts';

	var input = pluginData[target];
	if (!Array.isArray(input) || !input.length) {
		return callback();
	}

	var scripts = [];
	async.each(input, function (filePath, next) {
		resolveModulePath(pluginData.path, filePath, function (err, modulePath) {
			if (err) {
				return next(err);
			}

			if (modulePath) {
				scripts.push(modulePath);
			}
			next();
		});
	}, function (err) {
		if (err) {
			return callback(err);
		}

		if (scripts.length && global.env === 'development') {
			winston.verbose('[plugins] Found ' + scripts.length + ' js file(s) for plugin ' + pluginData.id);
		}
		callback(err, scripts);
	});
}
Data.getScripts = getScripts;

function getModules(pluginData, callback) {
	if (!pluginData.modules || !pluginData.hasOwnProperty('modules')) {
		return callback();
	}

	var pluginModules = pluginData.modules;

	if (Array.isArray(pluginModules)) {
		var strip = parseInt(pluginData.modulesStrip, 10) || 0;

		pluginModules = pluginModules.reduce(function (prev, modulePath) {
			var key;
			if (strip) {
				key = modulePath.replace(new RegExp('.?(/[^/]+){' + strip + '}/'), '');
			} else {
				key = path.basename(modulePath);
			}

			prev[key] = modulePath;
			return prev;
		}, {});
	}

	var modules = {};
	async.each(Object.keys(pluginModules), function (key, next) {
		resolveModulePath(pluginData.path, pluginModules[key], function (err, modulePath) {
			if (err) {
				return next(err);
			}

			if (modulePath) {
				modules[key] = path.relative(basePath, modulePath);
			}
			next();
		});
	}, function (err) {
		if (err) {
			return callback(err);
		}

		if (global.env === 'development') {
			var len = Object.keys(modules).length;
			winston.verbose('[plugins] Found ' + len + ' AMD-style module(s) for plugin ' + pluginData.id);
		}
		callback(null, modules);
	});
}
Data.getModules = getModules;

function getSoundpack(pluginData, callback) {
	var spack = pluginData.soundpack;
	if (!spack || !spack.dir || !spack.sounds) {
		return callback();
	}

	var soundpack = {};
	soundpack.name = spack.name || pluginData.name;
	soundpack.id = pluginData.id;
	soundpack.dir = path.join(pluginData.path, spack.dir);
	soundpack.sounds = {};

	async.each(Object.keys(spack.sounds), function (name, next) {
		var soundFile = spack.sounds[name];
		file.exists(path.join(soundpack.dir, soundFile), function (err, exists) {
			if (err) {
				return next(err);
			}
			if (!exists) {
				winston.warn('[plugins] Sound file not found: ' + soundFile);
				return next();
			}

			soundpack.sounds[name] = soundFile;
			next();
		});
	}, function (err) {
		if (err) {
			return callback(err);
		}

		if (global.env === 'development') {
			var len = Object.keys(soundpack).length;
			winston.verbose('[plugins] Found ' + len + ' sound file(s) for plugin ' + pluginData.id);
		}
		callback(null, soundpack);
	});
}
Data.getSoundpack = getSoundpack;
