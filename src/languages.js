var	fs = require('fs'),
	path = require('path'),
	async = require('async'),

	Languages = {};

Languages.list = function(callback) {
	var	languagesPath = path.join(__dirname, '../public/language'),
		languages = [];

	fs.readdir(languagesPath, function(err, files) {
		async.each(files, function(folder, next) {
			fs.stat(path.join(languagesPath, folder), function(err, stat) {
				if (!err) {
					if (stat.isDirectory()) {
						var configPath = path.join(languagesPath, folder, 'language.json');
						fs.exists(configPath, function(exists) {
							if (exists) {
								fs.readFile(configPath, function(err, stream) {
									languages.push(JSON.parse(stream.toString()));
									next();
								});
							} else {
								next();
							}
						});
					} else {
						next();
					}
				} else {
					next();
				}
			});
		}, function(err) {
			// Sort alphabetically
			languages = languages.sort(function(a, b) {
				return a.code > b.code ? 1 : -1;
			});

			callback(err, languages);
		});
	});
};

module.exports = Languages;
