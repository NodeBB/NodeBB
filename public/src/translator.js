(function (module) {
	"use strict";
	/*global RELATIVE_PATH, config*/


	var translator = {},
		files = {
			loaded: {},
			loading: {},
			callbacks: {} // could be combined with "loading" in future.
		};

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
			translator.translate('[[language:dir]]', function(value) {
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
					value = value.replace('%' + i, variable);
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

		if (!keys) {
			return callback(data);
		}

		for (var i=0; i<keys.length; ++i) {
			var key = keys[i];

			key = '' + key;
			var variables = key.split(/[,][?\s+]/);

			var parsedKey = key.replace('[[', '').replace(']]', '').split(':');
			if (!(parsedKey[0] && parsedKey[1])) {
				continue;
			}

			var languageFile = parsedKey[0];
			parsedKey = ('' + parsedKey[1]).split(',')[0];

			if (files.loaded[languageFile]) {
				data = insertLanguage(data, key, files.loaded[languageFile][parsedKey], variables);
			} else {
				loading++;
				(function (languageKey, parsedKey, languageFile, variables) {
					translator.load(languageFile, function (languageData) {
						data = insertLanguage(data, languageKey, languageData[parsedKey], variables);
						loading--;
						checkComplete();
					});
				}(key, parsedKey, languageFile, variables));
			}
		}

		checkComplete();

		function checkComplete() {
			if (loading === 0) {
				callback(data);
			}
		}
	};

	translator.clearLoadedFiles = function() {
		files.loaded = {};
		files.loading = {};
	};

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

			files.loading[filename] = true;

			load(filename, function(language) {
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

	function load(filename, callback) {
		if ('undefined' !== typeof window) {
			loadClient(filename, callback);
		} else {
			loadServer(filename, callback);
		}
	}

	function loadClient(filename, callback) {
		var timestamp = new Date().getTime();
		$.getJSON(config.relative_path + '/language/' + config.defaultLang + '/' + filename + '.json?v=' + timestamp, callback);
	}

	function loadServer(filename, callback) {
		var fs = require('fs'),
			path = require('path'),
			winston = require('winston'),
			meta = require('../../src/meta'),
			language = meta.config.defaultLang || 'en_GB';

		if (!fs.existsSync(path.join(__dirname, '../language', language))) {
			winston.warn('[translator] Language \'' + meta.config.defaultLang + '\' not found. Defaulting to \'en_GB\'');
			language = 'en_GB';
		}

		fs.readFile(path.join(__dirname, '../language', language, filename + '.json'), function(err, data) {
			if (err) {
				return winston.error(err.message);
			}

			callback(JSON.parse(data.toString()));
		});
	}

	if ('undefined' !== typeof window) {
		window.translator = module.exports;
	}

})('undefined' === typeof module ? {
	module: {
		exports: {}
	}
} : module);