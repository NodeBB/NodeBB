(function (module) {
	"use strict";
	/*global RELATIVE_PATH*/

	/*
	 * TODO:
	 *
	 * 1. language en is hardcoded while system is developed. to switch language packs for now please edit DEFAULT_LANGUAGE
	 *     b. need to write fallback system to default language if keys are missing (is this even necessary?)
	 * 2. recursion needed when parsing language keys (ex. topics:modal.delete.title), right now json is all one level deep
	 * 3. server side settings for default language
	 * 4. user side settings for preferred language
	 *
	 */

	var DEFAULT_LANGUAGE = 'en';

	var translator = {},
		files = {
			loaded: {},
			loading: {},
			callbacks: {} // could be combined with "loading" in future.
		},
		isServer = false;

	module.exports = translator;

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

	translator.mget = function (keys, callback) {

		var async = require('async');

		function getKey(key, callback) {
			translator.get(key, function(value) {
				callback(null, value);
			});
		}

		async.map(keys, getKey, callback);
	}


	/*
	 * TODO: Not fully converted to server side yet, ideally server should be able to parse whole templates on demand if necessary
	 * fix: translator.load should determine if server side and immediately return appropriate language file.
	 */
	translator.translate = function (data, callback) {
		var keys = data.match(/\[\[.*?\]\]/g),
			loading = 0;

		function insertLanguage(text, key, value, variables) {
			if (value) {
				for (var i = 1, ii = variables.length; i < ii; i++) {
					var variable = variables[i].replace(']]', '');
					value = value.replace('%' + i, variable);
				}

				text = text.replace(key, value);
			}


			return text;
		}

		for (var key in keys) {
			if (keys.hasOwnProperty(key)) {
				var variables = keys[key].split(/[,][?\s+]/);

				var parsedKey = keys[key].replace('[[', '').replace(']]', '').split(':');
				if (!(parsedKey[0] && parsedKey[1])) continue;
				
				var languageFile = parsedKey[0];
				parsedKey = parsedKey[1].split(',')[0];

				if (files.loaded[languageFile]) {
					data = insertLanguage(data, keys[key], files.loaded[languageFile][parsedKey], variables);
				} else {
					loading++;
					(function (languageKey, parsedKey, languageFile, variables) {
						translator.load(languageFile, function (languageData) {
							data = insertLanguage(data, languageKey, languageData[parsedKey], variables);
							loading--;
							checkComplete();
						});
					}(keys[key], parsedKey, languageFile, variables));

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

			jQuery.getJSON(RELATIVE_PATH + '/language/' + DEFAULT_LANGUAGE + '/' + filename + '.json?v=' + timestamp, function (language) {
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

		utils.walk(path.join(__dirname, '../../', 'public/language/' + DEFAULT_LANGUAGE), function (err, data) {
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