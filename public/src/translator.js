(function (module) {
	"use strict";
	/*global RELATIVE_PATH, config*/


	var translator = {},
		languages = {};

	module.exports = translator;

	translator.addTranslation = function(language, filename, translations) {
		languages[language] = languages[language] || {};
		languages[language].loaded = languages[language].loaded || {};
		languages[language].loaded[filename] = translations;
		languages[language].loading = languages[language].loading || {};
	};

	translator.getLanguage = function() {
		return config.defaultLang;
	};

	translator.prepareDOM = function() {
		// Load the appropriate timeago locale file
		if (config.userLang !== 'en_GB' && config.userLang !== 'en_US') {
			// Correct NodeBB language codes to timeago codes, if necessary
			var	languageCode;
			switch(config.userLang) {
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
				languageCode = config.userLang;
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

	translator.translate = function (data, language, callback) {
		if (typeof language === 'function') {
			callback = language;
			if ('undefined' !== typeof window && config) {
				language = config.userLang || 'en_GB';
			} else {
				var meta = require('../../src/meta');
				language = meta.config.defaultLang || 'en_GB';
			}
		}

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
			var variables = key.split(/[,][\s]*/);

			var parsedKey = key.replace('[[', '').replace(']]', '').split(':');
			if (!(parsedKey[0] && parsedKey[1])) {
				continue;
			}

			var languageFile = parsedKey[0];
			parsedKey = ('' + parsedKey[1]).split(',')[0];

			if (isLanguageFileLoaded(language, languageFile)) {
				data = insertLanguage(data, key, languages[language].loaded[languageFile][parsedKey], variables);
			} else {
				loading++;
				(function (languageKey, parsedKey, languageFile, variables) {
					translator.load(language, languageFile, function (languageData) {
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

	translator.compile = function() {
		var args = Array.prototype.slice.call(arguments, 0);

		return '[[' + args.join(', ') + ']]';
	};

	translator.load = function (language, filename, callback) {
		if (isLanguageFileLoaded(language, filename)) {
			if (callback) {
				callback(languages[language].loaded[filename]);
			}
		} else if (isLanguageFileLoading(language, filename)) {
			if (callback) {
				addLanguageFileCallback(language, filename, callback);
			}
		} else {

			languages[language] = languages[language] || {loading: {}, loaded: {}, callbacks: []};

			languages[language].loading[filename] = true;

			load(language, filename, function(translations) {

				languages[language].loaded[filename] = translations;

				if (callback) {
					callback(translations);
				}

				while (languages[language].callbacks[filename] && languages[language].callbacks[filename].length) {
					languages[language].callbacks[filename].pop()(translations);
				}

				languages[language].loading[filename] = false;
			});
		}
	};

	function isLanguageFileLoaded(language, filename) {
		var languageObj = languages[language];
		return languageObj && languageObj.loaded && languageObj.loaded[filename] && !languageObj.loading[filename];
	}

	function isLanguageFileLoading(language, filename) {
		return languages[language] && languages[language].loading && languages[language].loading[filename];
	}

	function addLanguageFileCallback(language, filename, callback) {
		languages[language].callbacks = languages[language].callbacks || {};

		languages[language].callbacks[filename] = languages[language].callbacks[filename] || [];
		languages[language].callbacks[filename].push(callback);
	}

	function load(language, filename, callback) {
		if ('undefined' !== typeof window) {
			loadClient(language, filename, callback);
		} else {
			loadServer(language, filename, callback);
		}
	}

	function loadClient(language, filename, callback) {
		$.getJSON(config.relative_path + '/language/' + language + '/' + filename + '.json?v=' + config['cache-buster'], callback);
	}

	function loadServer(language, filename, callback) {
		var fs = require('fs'),
			path = require('path'),
			winston = require('winston'),
			meta = require('../../src/meta');

		language = language || meta.config.defaultLang || 'en_GB';

		if (!fs.existsSync(path.join(__dirname, '../language', language))) {
			winston.warn('[translator] Language \'' + meta.config.defaultLang + '\' not found. Defaulting to \'en_GB\'');
			language = 'en_GB';
		}

		fs.readFile(path.join(__dirname, '../language', language, filename + '.json'), function(err, data) {
			if (err) {
				winston.error('Could not load `' + filename + '`: ' + err.message + '. Skipping...');
				return callback({});
			}

			try {
				callback(JSON.parse(data.toString()));
			} catch (e) {
				winston.error('Could not parse `' + filename + '.json`, syntax error? Skipping...');
				callback({});
			}
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
