'use strict';

var	fs = require('fs'),
	path = require('path'),
	async = require('async'),
	LRU = require('lru-cache'),
	_ = require('underscore');

var plugins = require('./plugins');

var Languages = {};

Languages.init = function (next) {
	if (Languages.hasOwnProperty('_cache')) {
		Languages._cache.reset();
	} else {
		Languages._cache = LRU(100);
	}

	next();
};

Languages.get = function (code, key, callback) {
	var combined = [code, key].join('/');

	if (Languages._cache && Languages._cache.has(combined)) {
		return callback(null, Languages._cache.get(combined));
	}

	var languageData;

	fs.readFile(path.join(__dirname, '../public/language/', code, key), { encoding: 'utf-8' }, function (err, data) {
		if (err && err.code !== 'ENOENT') {
			return callback(err);
		}

		// If language file in core cannot be read, then no language file present
		try {
			languageData = JSON.parse(data) || {};
		} catch (e) {
			languageData = {};
		}

		if (plugins.customLanguages.hasOwnProperty(combined)) {
			_.extendOwn(languageData, plugins.customLanguages[combined]);
		}

		if (Languages._cache) {
			Languages._cache.set(combined, languageData);
		}

		callback(null, languageData);
	});
};

Languages.list = function (callback) {
	var	languagesPath = path.join(__dirname, '../public/language'),
		languages = [];

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
						next();
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
