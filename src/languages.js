'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');

var Languages = {};
var	languagesPath = path.join(__dirname, '../build/public/language');

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

				fs.readFile(configPath, function (err, buffer) {
					if (err && err.code !== 'ENOENT') {
						return next(err);
					}
					if (buffer) {
						languages.push(JSON.parse(buffer.toString()));
					}
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
