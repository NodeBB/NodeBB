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
			var languages = [], namespaces = [];

			function extrude(languageDir, paths) {
				paths.forEach(function (p) {
					var rel = p.split(languageDir)[1].split(/[\/\\]/).slice(1);
					var language = rel.shift().replace('_', '-').replace('@', '-x-');
					var namespace = rel.join('/').replace(/\.json$/, '');

					if (!language || !namespace) {
						return;
					}

					if (languages.indexOf(language) === -1) {
						languages.push(language);
					}
					if (namespaces.indexOf(namespace) === -1) {
						namespaces.push(namespace);
					}
				});
			}

			plugins = plugins.filter(function (pluginData) {
				return (typeof pluginData.languages === 'string');
			});
			async.parallel([
				function (nxt) {
					utils.walk(coreLanguagesPath, function (err, paths) {
						if (err) {
							return nxt(err);
						}

						extrude(coreLanguagesPath, paths);
						nxt();
					});
				},
				function (nxt) {
					async.each(plugins, function (pluginData, cb) {
						var pathToFolder = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages);
						utils.walk(pathToFolder, function (err, paths) {
							if (err) {
								return cb(err);
							}

							extrude(pathToFolder, paths);
							cb();
						});
					}, nxt);
				},
			], function (err) {
				if (err) {
					return next(err);
				}

				next(null, {
					languages: languages,
					namespaces: namespaces,
					plugins: plugins,
				});
			});
		},
		function (ref, next) {
			var languages = ref.languages;
			var namespaces = ref.namespaces;
			var plugins = ref.plugins;

			var tree = {};

			async.eachLimit(languages, 10, function (lang, nxt) {
				async.eachLimit(namespaces, 10, function (ns, cb) {
					var translations = {};
					async.series([
						function (n) {
							fs.readFile(path.join(coreLanguagesPath, lang, ns + '.json'), function (err, buffer) {
								if (err) {
									if (err.code === 'ENOENT') {
										return n();
									}
									return n(err);
								}

								try {
									Object.assign(translations, JSON.parse(buffer.toString()));
									n();
								} catch (err) {
									n(err);
								}
							});
						},
						function (n) {
							async.eachLimit(plugins, 10, function (pluginData, call) {
								var pluginLanguages = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages);
								function tryLang(lang, onEnoent) {
									fs.readFile(path.join(pluginLanguages, lang, ns + '.json'), function (err, buffer) {
										if (err) {
											if (err.code === 'ENOENT') {
												return onEnoent();
											}
											return call(err);
										}

										try {
											Object.assign(translations, JSON.parse(buffer.toString()));
											call();
										} catch (err) {
											call(err);
										}
									});
								}

								tryLang(lang, function () {
									tryLang(lang.replace('-', '_').replace('-x-', '@'), function () {
										tryLang(pluginData.defaultLang, function () {
											tryLang(pluginData.defaultLang.replace('-', '_').replace('-x-', '@'), call);
										});
									});
								});
							}, function (err) {
								if (err) {
									return n(err);
								}

								tree[lang] = tree[lang] || {};
								tree[lang][ns] = translations;
								n();
							});
						},
					], cb);
				}, nxt);
			}, function (err) {
				next(err, tree);
			});
		},
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
