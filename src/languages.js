'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var LRU = require('lru-cache');

var plugins = require('./plugins');

var Languages = {};
var	languagesPath = path.join(__dirname, '../public/language');

Languages.init = function (next) {
	if (Languages.hasOwnProperty('_cache')) {
		Languages._cache.reset();
	} else {
		Languages._cache = LRU(100);
	}

	next();
};

Languages.get = function (language, namespace, callback) {
	var langNamespace = language + '/' + namespace;

	if (Languages._cache && Languages._cache.has(langNamespace)) {
		return callback(null, Languages._cache.get(langNamespace));
	}

	var languageData;

	fs.readFile(path.join(languagesPath, language, namespace + '.json'), { encoding: 'utf-8' }, function (err, data) {
		if (err && err.code !== 'ENOENT') {
			return callback(err);
		}

		// If language file in core cannot be read, then no language file present
		try {
			languageData = JSON.parse(data) || {};
		} catch (e) {
			languageData = {};
		}

		if (plugins.customLanguages.hasOwnProperty(langNamespace)) {
			Object.assign(languageData, plugins.customLanguages[langNamespace]);
		}

		if (Languages._cache) {
			Languages._cache.set(langNamespace, languageData);
		}

		callback(null, languageData);
	});
};

Languages.list = function (callback) {
	var languages = [];

	fs.readdir(languagesPath, function (err, files) {
		if (err) {
			return callback(err);
		}

		async.each(files, function (folder, next) {
			fs.stat(path.join(languagesPath, folder), function (err, stat) {
				if (err) {
					return next(err);
				}

				if (!stat.isDirectory()) {
					return next();
				}

				var configPath = path.join(languagesPath, folder, 'language.json');

				fs.readFile(configPath, function (err, stream) {
					if (err) {
						return next(err);
					}
					languages.push(JSON.parse(stream.toString()));
					next();
				});
			});
		}, function (err) {
			if (err) {
				return callback(err);
			}
			// Sort alphabetically
			languages = languages.sort(function (a, b) {
				return a.code > b.code ? 1 : -1;
			});

			callback(err, languages);
		});
	});
};

module.exports = Languages;
