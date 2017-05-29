'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');

var Languages = module.exports;
var languagesPath = path.join(__dirname, '../build/public/language');

Languages.init = function (next) {
	next();
};

Languages.get = function (language, namespace, callback) {
	fs.readFile(path.join(languagesPath, language, namespace + '.json'), { encoding: 'utf-8' }, function (err, data) {
		if (err) {
			return callback(err);
		}

		try {
			data = JSON.parse(data) || {};
		} catch (e) {
			return callback(e);
		}

		callback(null, data);
	});
};

var codeCache = null;
Languages.listCodes = function (callback) {
	if (codeCache && codeCache.length) {
		return callback(null, codeCache);
	}

	fs.readFile(path.join(languagesPath, 'metadata.json'), function (err, buffer) {
		if (err && err.code === 'ENOENT') {
			return callback(null, []);
		}
		if (err) {
			return callback(err);
		}

		var parsed;
		try {
			parsed = JSON.parse(buffer.toString());
		} catch (e) {
			return callback(e);
		}

		var langs = parsed.languages;
		codeCache = langs;
		callback(null, langs);
	});
};

var listCache = null;
Languages.list = function (callback) {
	if (listCache && listCache.length) {
		return callback(null, listCache);
	}

	Languages.listCodes(function (err, codes) {
		if (err) {
			return callback(err);
		}

		async.map(codes, function (folder, next) {
			var configPath = path.join(languagesPath, folder, 'language.json');

			fs.readFile(configPath, function (err, buffer) {
				if (err && err.code === 'ENOENT') {
					return next();
				}
				if (err) {
					return next(err);
				}
				try {
					var lang = JSON.parse(buffer.toString());
					next(null, lang);
				} catch (e) {
					next(e);
				}
			});
		}, function (err, languages) {
			if (err) {
				return callback(err);
			}

			// filter out invalid ones
			languages = languages.filter(function (lang) {
				return lang && lang.code && lang.name && lang.dir;
			});

			listCache = languages;
			callback(null, languages);
		});
	});
};
