'use strict';

var winston = require('winston');
var path = require('path');
var async = require('async');
var fs = require('fs');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');

var file = require('../file');
var Plugins = require('../plugins');

var buildLanguagesPath = path.join(__dirname, '../../build/public/language');
var coreLanguagesPath = path.join(__dirname, '../../public/language');

function getTranslationTree(callback) {
	async.waterfall([
		// get plugin data
		Plugins.data.getActive,

		// generate list of languages and namespaces
		function (plugins, next) {
			var languages = [];
			var namespaces = [];

			// pull languages and namespaces from paths
			function extrude(languageDir, paths) {
				paths.forEach(function (p) {
					var rel = p.split(languageDir)[1].split(/[/\\]/).slice(1);
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
				// get core languages and namespaces
				function (nxt) {
					file.walk(coreLanguagesPath, function (err, paths) {
						if (err) {
							return nxt(err);
						}

						extrude(coreLanguagesPath, paths);
						nxt();
					});
				},
				// get plugin languages and namespaces
				function (nxt) {
					async.each(plugins, function (pluginData, cb) {
						var pathToFolder = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages);
						file.walk(pathToFolder, function (err, paths) {
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

		// save a list of languages to `${buildLanguagesPath}/metadata.json`
		// avoids readdirs later on
		function (ref, next) {
			async.waterfall([
				function (next) {
					mkdirp(buildLanguagesPath, next);
				},
				function (x, next) {
					fs.writeFile(path.join(buildLanguagesPath, 'metadata.json'), JSON.stringify({
						languages: ref.languages.sort(),
						namespaces: ref.namespaces.sort(),
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
			var plugins = ref.plugins;

			var tree = {};

			async.eachLimit(languages, 10, function (lang, nxt) {
				async.eachLimit(namespaces, 10, function (ns, cb) {
					var translations = {};

					async.series([
						// core first
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
							// for each plugin, fallback in this order:
							//  1. correct language string (en-GB)
							//  2. old language string (en_GB)
							//  3. corrected plugin defaultLang (en-US)
							//  4. old plugin defaultLang (en_US)
							async.eachLimit(plugins, 10, function (pluginData, call) {
								var pluginLanguages = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages);
								var defaultLang = pluginData.defaultLang || 'en-GB';

								async.some([
									lang,
									lang.replace('-', '_').replace('-x-', '@'),
									defaultLang.replace('_', '-').replace('@', '-x-'),
									defaultLang.replace('-', '_').replace('-x-', '@'),
								], function (language, next) {
									fs.readFile(path.join(pluginLanguages, language, ns + '.json'), function (err, buffer) {
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
								}, call);
							}, function (err) {
								if (err) {
									return n(err);
								}

								if (Object.keys(translations).length) {
									tree[lang] = tree[lang] || {};
									tree[lang][ns] = translations;
								}
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

// write translation hashes from the generated tree to language files
function writeLanguageFiles(tree, callback) {
	// iterate over languages and namespaces
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
