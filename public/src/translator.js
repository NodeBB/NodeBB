(function (module) {
	"use strict";
	/*global RELATIVE_PATH, config*/

	/*
	 * TODO:
	 	* user side settings for preferred language
	 */

	var translator = {},
		files = {
			loaded: {},
			loading: {},
			callbacks: {} // could be combined with "loading" in future.
		},
		isServer = false;

	module.exports = translator;

	// Use this in plugins to add your own translation files.
	translator.addTranslation = function(filename, translations) {
		files.loaded[filename] = translations;
	};

	translator.getLanguage = function() {
		return config.defaultLang;
	};

	translator.prepareDOM = function() {
		// Load the appropriate timeago locale file
		if (config.defaultLang !== 'en_GB') {
			// Correct NodeBB language codes to timeago codes, if necessary
			var	languageCode;
			switch(config.defaultLang) {
			case 'cs':
				languageCode = 'cz';
				break;

			case 'fa_IR':
				languageCode = 'fa';
				break;

			case 'pt_BR':
				languageCode = 'pt-br';
				break;

			case 'zh_TW':
				languageCode = 'zh-TW';
				break;

			case 'zh_CN':
				languageCode = 'zh-CN';
				break;

			default:
				languageCode = config.defaultLang;
				break;
			}

			$.getScript(RELATIVE_PATH + '/vendor/jquery/timeago/locales/jquery.timeago.' + languageCode + '.js').success(function() {
				$('span.timeago').timeago();
			}).fail(function() {
				$.getScript(RELATIVE_PATH + '/vendor/jquery/timeago/locales/jquery.timeago.en.js');
			});

			// Add directional code if necessary
			translator.get('language:dir', function(value) {
				if (value) {
					$('html').css('direction', value).attr('data-dir', value);
				}
			});
		}
	};

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
	};

	translator.translate = function (data, callback) {
		if (!data) {
			return callback(data);	
		}

		function insertLanguage(text, key, value, variables) {
			if (value) {
				for (var i = 1, ii = variables.length; i < ii; i++) {
					var variable = variables[i].replace(']]', '');
					value = ('' + value).replace('%' + i, variable);
				}

				text = text.replace(key, value);
			} else {
				var string = key.split(':');
				text = text.replace(key, string[string.length-1].replace(/\]+$/, ''));
			}

			return text;
		}

		var keys = data.match(/\[\[.*?\]\]/g),
			loading = 0;

		for (var key in keys) {
			if (keys.hasOwnProperty(key)) {
				keys[key] = '' + keys[key];
				var variables = keys[key].split(/[,][?\s+]/);

				var parsedKey = keys[key].replace('[[', '').replace(']]', '').split(':');
				if (!(parsedKey[0] && parsedKey[1])) {
					continue;
				}

				var languageFile = parsedKey[0];
				parsedKey = ('' + parsedKey[1]).split(',')[0];

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

			$.getJSON(RELATIVE_PATH + '/language/' + config.defaultLang + '/' + filename + '.json?v=' + timestamp, function (language) {
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
			Meta = require('../../src/meta'),
			path = require('path'),
			fs = require('fs'),
			winston = require('winston'),
			language = Meta.config.defaultLang || 'en_GB';


		if (!fs.existsSync(path.join(__dirname, '../language', language))) {
			winston.warn('[translator] Language \'' + Meta.config.defaultLang + '\' not found. Defaulting to \'en_GB\'');
			language = 'en_GB';
		}

		utils.walk(path.join(__dirname, '../language', language), function (err, data) {

			for (var d in data) {
				if (data.hasOwnProperty(d)) {
					// Only load .json files
					if (path.extname(data[d]) === '.json') {
						files.loaded[path.basename(data[d]).replace('.json', '')] = require(data[d]);
					} else {
						if (process.env.NODE_ENV === 'development') {
							winston.warn('[translator] Skipping language file: ' + path.relative(path.join(__dirname, '../language'), data[d]));
						}
					}
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
