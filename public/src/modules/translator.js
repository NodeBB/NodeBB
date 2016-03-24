;(function(translator) {
	"use strict";
	/* globals RELATIVE_PATH, config, define */

	var S = null;
	var stringDefer = null;

	// export the class if we are in a Node-like system.
	if (typeof module === 'object' && module.exports === translator) {
		exports = module.exports = translator;
		S = require('string');
	} else {
		stringDefer = $.Deferred();
		require(['string'], function(stringLib) {
			S = stringLib;
			stringDefer.resolve(S);
		});
	}

	var	languages = {},
		regexes = {
			match: /\[\[\w+:[\w\.]+((?!\[\[).)*?\]\]/g,	// see tests/translator.js for an explanation re: this monster
			split: /[,][\s]*/,
			replace: /\]+$/
		};

	translator.addTranslation = function(language, filename, translations) {
		languages[language] = languages[language] || {};
		languages[language].loaded = languages[language].loaded || {};
		languages[language].loading = languages[language].loading || {};

		if (languages[language].loaded[filename]) {
			var existing = languages[language].loaded[filename];
			for (var t in translations) {
				if (translations.hasOwnProperty(t)) {
					languages[language].loaded[filename][t] = translations[t];
				}
			}
		} else {
			languages[language].loaded[filename] = translations;
		}
	};

	translator.getTranslations = function(language, filename, callback) {
		if (languages[language] && languages[language].loaded[filename]) {
			callback(languages[language].loaded[filename]);
		} else {
			translator.load(language, filename, function() {
				callback(languages[language].loaded[filename]);
			});
		}
	};

	translator.escape = function(text) {
		return typeof text === 'string' ? text.replace(/\[\[([\S]*?)\]\]/g, '\\[\\[$1\\]\\]') : text;
	};

	translator.unescape = function(text) {
		return typeof text === 'string' ? text.replace(/\\\[\\\[([\S]*?)\\\]\\\]/g, '[[$1]]') : text;
	};

	translator.getLanguage = function() {
		return config.defaultLang;
	};

	translator.prepareDOM = function() {
		// Load the appropriate timeago locale file, and correct NodeBB language codes to timeago codes, if necessary
		var	languageCode;
		switch(config.userLang) {
			case 'en_GB':
			case 'en_US':
				languageCode = 'en';
				break;

			case 'cs':
				languageCode = 'cz';
				break;

			case 'fa_IR':
				languageCode = 'fa';
				break;

			case 'pt_BR':
				languageCode = 'pt-br';
				break;

			case 'nb':
				languageCode = 'no';
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
			$('.timeago').timeago();
			translator.timeagoShort = $.extend({}, jQuery.timeago.settings.strings);

			// Retrieve the shorthand timeago values as well
			$.getScript(RELATIVE_PATH + '/vendor/jquery/timeago/locales/jquery.timeago.' + languageCode + '-short.js').success(function() {
				// Switch back to long-form
				translator.toggleTimeagoShorthand();
			}).fail(function() {
				$.getScript(RELATIVE_PATH + '/vendor/jquery/timeago/locales/jquery.timeago.en-short.js').success(function() {
					// Switch back to long-form
					translator.toggleTimeagoShorthand();
				});
			});
		}).fail(function() {
			$.getScript(RELATIVE_PATH + '/vendor/jquery/timeago/locales/jquery.timeago.en-short.js').success(function() {
				// Switch back to long-form
				translator.toggleTimeagoShorthand();
				$.getScript(RELATIVE_PATH + '/vendor/jquery/timeago/locales/jquery.timeago.en.js');
			});
		});

		// Add directional code if necessary
		translator.translate('[[language:dir]]', function(value) {
			if (value) {
				$('html').css('direction', value).attr('data-dir', value);
			}
		});
	};

	translator.toggleTimeagoShorthand = function() {
		var tmp = $.extend({}, jQuery.timeago.settings.strings);
		jQuery.timeago.settings.strings = $.extend({}, translator.timeagoShort);
		translator.timeagoShort = $.extend({}, tmp);
	};

	translator.translate = function (text, language, callback) {
		if (typeof language === 'function') {
			callback = language;
			if ('undefined' !== typeof window && config) {
				language = utils.params().lang || config.userLang || 'en_GB';
			} else {
				var meta = require('../../../src/meta');
				language = meta.config.defaultLang || 'en_GB';
			}
		}

		if (!text) {
			return callback(text);
		}

		var keys = text.match(regexes.match);

		if (!keys) {
			return callback(text);
		}

		translateKeys(keys, text, language, function(translated) {
			keys = translated.match(regexes.match);
			if (!keys) {
				callback(translated);
			} else {
				translateKeys(keys, translated, language, callback);
			}
		});
	};

	function translateKeys(keys, text, language, callback) {

		var count = keys.length;
		if (!count) {
			return callback(text);
		}

		if (S === null) { // browser environment and S not yet initialized
			// we need to wait for async require call
			stringDefer.then(function () { translateKeys(keys, text, language, callback); });
			return;
		}

		var data = {text: text};
		keys.forEach(function(key) {
			translateKey(key, data, language, function(translated) {
				--count;
				if (count <= 0) {
					callback(translated.text);
				}
			});
		});
	}

	function translateKey(key, data, language, callback) {
		key = '' + key;
		var variables = key.split(regexes.split);

		var parsedKey = key.replace('[[', '').replace(']]', '').split(':');
		parsedKey = [parsedKey[0]].concat(parsedKey.slice(1).join(':'));
		if (!(parsedKey[0] && parsedKey[1])) {
			return callback(data);
		}

		var languageFile = parsedKey[0];
		parsedKey = ('' + parsedKey[1]).split(',')[0];

		translator.load(language, languageFile, function(languageData) {
			data.text = insertLanguage(data.text, key, languageData[parsedKey], variables);
			callback(data);
		});
	}

	function insertLanguage(text, key, value, variables) {
		if (value) {
			variables.forEach(function(variable, index) {
				if (index > 0) {
					variable = S(variable).chompRight(']]').collapseWhitespace().decodeHTMLEntities().escapeHTML().s;
					value = value.replace('%' + index, function() { return variable; });
				}
			});

			text = text.replace(key, function() { return value; });
		} else {
			var string = key.split(':');
			text = text.replace(key, string[string.length-1].replace(regexes.replace, ''));
		}

		return text;
	}

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

				while (languages[language].callbacks && languages[language].callbacks[filename] && languages[language].callbacks[filename].length) {
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
			file = require('../../../src/file'),
			plugins = require('../../../src/plugins'),
			meta = require('../../../src/meta');

		language = language || meta.config.defaultLang || 'en_GB';

		if (!file.existsSync(path.join(__dirname, '../../language', language))) {
			winston.warn('[translator] Language \'' + meta.config.defaultLang + '\' not found. Defaulting to \'en_GB\'');
			language = 'en_GB';
		}

		fs.readFile(path.join(__dirname, '../../language', language, filename + '.json'), function(err, data) {
			var onData = function(data) {
				try {
					data = JSON.parse(data.toString());
				} catch (e) {
					winston.error('Could not parse `' + filename + '.json`, syntax error? Skipping...');
					data = {};
				}
				callback(data);
			}

			if (err) {
				if (err.code === 'ENOENT' && plugins.customLanguageFallbacks.hasOwnProperty(filename)) {
					// Resource non-existant but fallback exists
					return fs.readFile(plugins.customLanguageFallbacks[filename], {
						encoding: 'utf-8'
					}, function(err, data) {
						if (err) {
							return winston.error('[translator] Could not load fallback language file for resource ' + filename);
						}

						onData(data);
					})
				} else {
					winston.error('[translator] Could not load `' + filename + '`: ' + err.message + '. Skipping...');
					return callback({});
				}
			}

			onData(data);
		});
	}

	// Use the define() function if we're in AMD land
	if (typeof define === 'function' && define.amd) {
		define('translator', translator);

		var _translator = translator;

		// Expose a global `translator` object for backwards compatibility
		window.translator = {
			translate: function() {
				if (typeof console !== 'undefined' && console.warn) {
					console.warn('[translator] Global invocation of the translator is now deprecated, please `require` the module instead.');
				}
				_translator.translate.apply(_translator, arguments);
			}
		}
	}
})(
	typeof exports === 'object' ? exports :
	typeof define === 'function' && define.amd ? {} :
	translator = {}
);
