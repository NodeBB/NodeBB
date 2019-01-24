'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');

var Languages = module.exports;
var languagesPath = path.join(__dirname, '../build/public/language');

const files = fs.readdirSync(path.join(__dirname, '../public/vendor/jquery/timeago/locales'));
Languages.timeagoCodes = files.filter(f => f.startsWith('jquery.timeago')).map(f => f.split('.')[2]);

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

	fs.readFile(path.join(languagesPath, 'metadata.json'), 'utf8', function (err, file) {
		if (err && err.code === 'ENOENT') {
			return callback(null, []);
		}
		if (err) {
			return callback(err);
		}

		var parsed;
		try {
			parsed = JSON.parse(file);
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

			fs.readFile(configPath, 'utf8', function (err, file) {
				if (err && err.code === 'ENOENT') {
					return next();
				}
				if (err) {
					return next(err);
				}
				var lang;
				try {
					lang = JSON.parse(file);
				} catch (e) {
					return next(e);
				}
				next(null, lang);
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
