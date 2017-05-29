'use strict';

var winston = require('winston');
var path = require('path');
var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var _ = require('lodash');

var file = require('../file');
var Plugins = require('../plugins');

var buildLanguagesPath = path.join(__dirname, '../../build/public/language');
var coreLanguagesPath = path.join(__dirname, '../../public/language');

function getTranslationTree(callback) {
	async.waterfall([
		// generate list of languages and namespaces
		function (next) {
			file.walk(coreLanguagesPath, next);
		},
		function (paths, next) {
			var languages = [];
			var namespaces = [];

			paths.forEach(function (p) {
				if (!p.endsWith('.json')) {
					return;
				}

				var rel = path.relative(coreLanguagesPath, p).split(/[/\\]/);
				var language = rel.shift().replace('_', '-').replace('@', '-x-');
				var namespace = rel.join('/').replace(/\.json$/, '');

				if (!language || !namespace) {
					return;
				}

				languages.push(language);
				namespaces.push(namespace);
			});

			next(null, {
				languages: _.union(languages, Plugins.languageData.languages).sort().filter(Boolean),
				namespaces: _.union(namespaces, Plugins.languageData.namespaces).sort().filter(Boolean),
			});
		},

		// save a list of languages to `${buildLanguagesPath}/metadata.json`
		// avoids readdirs later on
		function (ref, next) {
			async.waterfall([
				function (next) {
					mkdirp(buildLanguagesPath, next);
				},
				function (x, next) {
					fs.writeFile(path.join(buildLanguagesPath, 'metadata.json'), JSON.stringify({
						languages: ref.languages,
						namespaces: ref.namespaces,
					}), next);
				},
				function (next) {
					next(null, ref);
				},
			], next);
		},

		// for each language and namespace combination,
		// run through core and all plugins to generate
		// a full translation hash
		function (ref, next) {
			var languages = ref.languages;
			var namespaces = ref.namespaces;
			var plugins = _.values(Plugins.pluginsData).filter(function (plugin) {
				return typeof plugin.languages === 'string';
			});

			var tree = {};

			async.eachLimit(languages, 10, function (lang, next) {
				async.eachLimit(namespaces, 10, function (namespace, next) {
					var translations = {};

					async.series([
						// core first
						function (cb) {
							fs.readFile(path.join(coreLanguagesPath, lang, namespace + '.json'), function (err, buffer) {
								if (err) {
									if (err.code === 'ENOENT') {
										return cb();
									}
									return cb(err);
								}

								try {
									Object.assign(translations, JSON.parse(buffer.toString()));
									cb();
								} catch (err) {
									cb(err);
								}
							});
						},
						function (cb) {
							// for each plugin, fallback in this order:
							//  1. correct language string (en-GB)
							//  2. old language string (en_GB)
							//  3. corrected plugin defaultLang (en-US)
							//  4. old plugin defaultLang (en_US)
							async.eachLimit(plugins, 10, function (pluginData, done) {
								var pluginLanguages = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages);
								var defaultLang = pluginData.defaultLang || 'en-GB';

								async.some([
									lang,
									lang.replace('-', '_').replace('-x-', '@'),
									defaultLang.replace('_', '-').replace('@', '-x-'),
									defaultLang.replace('-', '_').replace('-x-', '@'),
								], function (language, next) {
									fs.readFile(path.join(pluginLanguages, language, namespace + '.json'), function (err, buffer) {
										if (err) {
											if (err.code === 'ENOENT') {
												return next(null, false);
											}
											return next(err);
										}

										try {
											Object.assign(translations, JSON.parse(buffer.toString()));
											next(null, true);
										} catch (err) {
											next(err);
										}
									});
								}, done);
							}, function (err) {
								if (err) {
									return cb(err);
								}

								if (Object.keys(translations).length) {
									tree[lang] = tree[lang] || {};
									tree[lang][namespace] = translations;
								}
								cb();
							});
						},
					], next);
				}, next);
			}, function (err) {
				next(err, tree);
			});
		},
	], callback);
}

// write translation hashes from the generated tree to language files
function writeLanguageFiles(tree, callback) {
	// iterate over languages and namespaces
	async.eachLimit(Object.keys(tree), 100, function (language, cb) {
		var namespaces = tree[language];
		async.eachLimit(Object.keys(namespaces), 10, function (namespace, next) {
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

exports.build = function buildLanguages(callback) {
	async.waterfall([
		function (next) {
			rimraf(buildLanguagesPath, next);
		},
		getTranslationTree,
		writeLanguageFiles,
	], function (err) {
		if (err) {
			winston.error('[build] Language build failed: ' + err.message);
			throw err;
		}
		callback();
	});
};
