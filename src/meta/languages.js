'use strict';

var winston = require('winston');
var path = require('path');
var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');

var file = require('../file');
var utils = require('../../public/src/utils');
var Plugins = require('../plugins');
var db = require('../database');

var buildLanguagesPath = path.join(__dirname, '../../build/public/language');
var	coreLanguagesPath = path.join(__dirname, '../../public/language');

function extrude(languageDir, paths) {
	return paths.map(function (p) {
		var rel = p.split(languageDir)[1].split(/[\/\\]/).slice(1);
		return {
			language: rel.shift().replace('_', '-').replace('@', '-x-'),
			namespace: rel.join('/').replace(/\.json$/, ''),
			path: p,
		};
	});
}

function getTranslationTree(callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('plugins:active', 0, -1, next);
		},
		function (plugins, next) {
			var pluginBasePath = path.join(__dirname, '../../node_modules');
			var paths = plugins.map(function (plugin) {
				return path.join(pluginBasePath, plugin);
			});

			// Filter out plugins with invalid paths
			async.filter(paths, file.exists, function (paths) {
				next(null, paths);
			});
		},
		function (paths, next) {
			async.map(paths, Plugins.loadPluginInfo, next);
		},
		function (plugins, next) {
			async.parallel({
				corePaths: function (cb) {
					utils.walk(coreLanguagesPath, function (err, paths) {
						if (err) {
							return cb(err);
						}

						cb(null, extrude(coreLanguagesPath, paths));
					});
				},
				pluginPaths: function (nxt) {
					plugins = plugins.filter(function (pluginData) {
						return (typeof pluginData.languages === 'string');
					});
					async.map(plugins, function (pluginData, cb) {
						var pathToFolder = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages);
						utils.walk(pathToFolder, function (err, paths) {
							if (err) {
								return cb(err);
							}

							cb(null, extrude(pathToFolder, paths));
						});
					}, nxt);
				}
			}, next);
		},
		function (data, next) {
			var paths = data.pluginPaths.concat.apply([], data.pluginPaths);
			paths = data.corePaths.concat(paths);
			paths = paths.filter(function (p) {
				return p.language && p.namespace && p.path;
			});

			var tree = {};
			
			async.eachLimit(paths, 1000, function (data, cb) {
				fs.readFile(data.path, function (err, file) {
					if (err) {
						return cb(err);
					}

					try {
						var obj = JSON.parse(file.toString());

						tree[data.language] = tree[data.language] || {};
						tree[data.language][data.namespace] = tree[data.language][data.namespace] || {};
						Object.assign(tree[data.language][data.namespace], obj);
						
						cb();
					} catch (e) {
						winston.warn('[build] Invalid JSON file at `' + data.path + '`');
						cb();
					}
				});
			}, function (err) {
				next(err, tree);
			});
		}
	], callback);
}

function writeLanguageFiles(tree, callback) {
	async.eachLimit(Object.keys(tree), 10, function (language, cb) {
		var namespaces = tree[language];
		async.eachLimit(Object.keys(namespaces), 100, function (namespace, next) {
			var translations = namespaces[namespace];

			var filePath = path.join(buildLanguagesPath, language, namespace + '.json');

			mkdirp(path.dirname(filePath), function (err) {
				if (err) {
					return next(err);
				}

				fs.writeFile(filePath, JSON.stringify(translations), next);
			});
		}, cb);
	}, callback);
}

module.exports = {
	build: function buildLanguages(callback) {
		async.waterfall([
			getTranslationTree,
			writeLanguageFiles,
		], function (err) {
			if (err) {
				winston.error('[build] Language build failed');
				throw err;
			}
			callback();
		});
	},
};
