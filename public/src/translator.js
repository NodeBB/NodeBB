(function (module) {
	"use strict";
	/*global RELATIVE_PATH*/

	/*
	 * TODO: language en is hardcoded while system is developed.
	 */

	var translator = {},
		files = {
			loaded: {},
			loading: {},
			callbacks: {}
		};

	module.exports = translator;

	translator.load = function (filename, callback) {
		if (files.loaded[filename] && !files.loading[filename]) {
			if (callback) {
				callback(files.loaded[filename]);
			}
		} else if (files.loading[filename]) {
			if (callback) {
				files.callbacks[filename] = files.callbacks[filename] || [];
				files.callbacks[filename].push(callback);
			}
		} else {
			var timestamp = new Date().getTime(); //debug

			files.loading[filename] = true;

			jQuery.getJSON(RELATIVE_PATH + '/language/en/' + filename + '.json?v=' + timestamp, function (language) {
				files.loaded[filename] = language;

				if (callback) {
					callback(language);
				}

				while (files.callbacks[filename] && files.callbacks[filename].length) {
					files.callbacks[filename].pop()(language);
				}

				files.loading[filename] = false;
			});
		}
	};

	translator.loadAll = function (callback) {
		var utils = require('./utils.js'),
			path = require('path'),
			fs = require('fs');

		utils.walk(path.join(__dirname, '../../', 'public/language/en'), function (err, data) {
			var loaded = data.length;

			for (var d in data) {
				if (data.hasOwnProperty(d)) {
					(function (file) {
						fs.readFile(file, function (err, json) {
							files.loaded[path.basename(file).replace('json', '')] = json;

							loaded--;
							if (loaded === 0) {
								callback();
							}
						});
					}(data[d]));
				}
			}
		});
	};

	/*
	 * TODO: DRY, see translator.translate. The hard part is to make sure both work node.js / js side
	 */
	translator.get = function (key) {
		var parsedKey = key.split(':'),
			languageFile = parsedKey[0];

		parsedKey = parsedKey[1];

		return files.loaded[languageFile][parsedKey];
	};


	/*
	 * TODO: Not fully converted to server side yet, ideally server should be able to parse whole templates on demand if necessary
	 * fix: translator.load should determine if server side and immediately return appropriate language file.
	 */
	translator.translate = function (data, callback) {
		var keys = data.match(/\[\[.*?\]\]/g),
			loading = 0;

		for (var key in keys) {
			if (keys.hasOwnProperty(key)) {
				var parsedKey = keys[key].replace('[[', '').replace(']]', '').split(':'),
					languageFile = parsedKey[0];

				parsedKey = parsedKey[1];

				if (files.loaded[languageFile]) {
					data = data.replace(keys[key], files.loaded[languageFile][parsedKey]);
				} else {
					loading++;

					(function (languageKey, parsedKey) {
						translator.load(languageFile, function (languageData) {
							data = data.replace(languageKey, languageData[parsedKey]);
							loading--;
							checkComplete();
						});
					}(keys[key], parsedKey));

				}
			}
		}

		checkComplete();

		function checkComplete() {
			if (loading === 0) {
				callback(data);
			}
		}

	};

	if ('undefined' !== typeof window) {
		window.translator = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);