(function (module) {
	"use strict";
	/*global RELATIVE_PATH*/

	/*
	 * TODO:
	 *
	 * 1. language en is hardcoded while system is developed.
	 *     b. need to write fallback system to default language
	 * 2. recursion needed when parsing language keys (ex. topics:modal.delete.title), right now json is all one level deep
	 * 3. server side settings for default language
	 * 4. user side settings for preferred language
	 *
	 */

	var translator = {},
		files = {
			loaded: {},
			loading: {},
			callbacks: {} // could be combined with "loading" in future.
		},
		isServer = false;

	module.exports = translator;

	/*
	 * TODO: DRY, see translator.translate. The hard part is to make sure both work node.js / js side
	 */
	translator.get = function (key, callback) {
		var parsedKey = key.split(':'),
			languageFile = parsedKey[0];

		parsedKey = parsedKey[1];
		translator.load(languageFile, function (languageData) {
			if (callback) {
				callback(languageData[parsedKey]);
			}

			return languageData[parsedKey];
		});
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
				//check for additional variables then keys[key].split(/[,][?\s+]/);

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

	translator.load = function (filename, callback) {
		if (isServer === true) {
			if (callback) {
				callback(files.loaded[filename]);
			}

			return files.loaded[filename];
		}

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

	translator.loadServer = function () {
		isServer = true;

		var utils = require('./utils.js'),
			path = require('path'),
			fs = require('fs');

		utils.walk(path.join(__dirname, '../../', 'public/language/en'), function (err, data) {
			var loaded = data.length;

			for (var d in data) {
				if (data.hasOwnProperty(d)) {
					files.loaded[path.basename(data[d]).replace('.json', '')] = require(data[d]);
				}
			}
		});
	};

	if ('undefined' !== typeof window) {
		window.translator = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);