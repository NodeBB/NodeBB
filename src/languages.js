'use strict';

var	fs = require('fs'),
	path = require('path'),
	async = require('async'),

	Languages = {};

Languages.list = function(callback) {
	var	languagesPath = path.join(__dirname, '../public/language'),
		languages = [];

	fs.readdir(languagesPath, function(err, files) {
		if (err) {
			return callback(err);
		}

		async.each(files, function(folder, next) {
			fs.stat(path.join(languagesPath, folder), function(err, stat) {
				if (err) {
					return next(err);
				}

				if (!stat.isDirectory()) {
					return next();
				}

				var configPath = path.join(languagesPath, folder, 'language.json');

				fs.readFile(configPath, function(err, stream) {
					if (err) {
						next();
					}
					languages.push(JSON.parse(stream.toString()));
					next();
				});
			});
		}, function(err) {
			if (err) {
				return callback(err);
			}
			// Sort alphabetically
			languages = languages.sort(function(a, b) {
				return a.code > b.code ? 1 : -1;
			});

			callback(err, languages);
		});
	});
};

module.exports = Languages;
