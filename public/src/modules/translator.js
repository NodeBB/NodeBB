/* global define, jQuery, config, RELATIVE_PATH, utils, window, Promise */

(function (factory) {
	'use strict';
	function loadClient(language, filename) {
		return Promise.resolve(jQuery.getJSON(config.relative_path + '/language/' + language + '/' + (filename + '.json?v=' + config['cache-buster'])));
	}
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as a named module
		define('translator', ['string'], function (string) {
			return factory(string, loadClient);
		});
	} else if (typeof module === 'object' && module.exports) {
		// Node
		(function () {
			require('promise-polyfill');
			var languages = require('../../../src/languages');

			function loadServer(language, filename) {
				return new Promise(function (resolve, reject) {
					languages.get(language, filename + '.json', function (err, data) {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						}
					});
				});
			}

			module.exports = factory(require('string'), loadServer);
		})();
	} else {
		window.translator = factory(window.string, loadClient);
	}
})(function (string, load) {
	'use strict';
	var assign = Object.assign || jQuery.extend;
	function classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var Translator = function () {
		/**
		 * Construct a new Translator object
		 * @param {string} language - Language code for this translator instance
		 */
		function Translator(language) {
			classCallCheck(this, Translator);

			if (!language) {
				throw new TypeError('Parameter `language` must be a language string. Received ' + language + (language === '' ? '(empty string)' : ''));
			}

			this.lang = language;
			this.translations = {};
		}

		Translator.prototype.load = load;

		/**
		 * Parse the translation instructions into the language of the Translator instance
		 * @param {string} str - Source string
		 * @returns {Promise<string>}
		 */
		Translator.prototype.translate = function translate(str) {
			// current cursor position
			var cursor = 0;
			// last break of the input string
			var lastBreak = 0;
			// length of the input string
			var len = str.length;
			// array to hold the promises for the translations
			// and the strings of untranslated text in between
			var toTranslate = [];

			// split a translator string into an array of tokens
			// but don't split by commas inside other translator strings
			function split(text) {
				var len = text.length;
				var arr = [];
				var i = 0;
				var brk = 0;
				var level = 0;

				while (i + 2 <= len) {
					if (text.slice(i, i + 2) === '[[') {
						level += 1;
						i += 1;
					} else if (text.slice(i, i + 2) === ']]') {
						level -= 1;
						i += 1;
					} else if (level === 0 && text[i] === ',') {
						arr.push(text.slice(brk, i).trim());
						i += 1;
						brk = i;
					}
					i += 1;
				}
				arr.push(text.slice(brk, i + 1).trim());
				return arr;
			}

			// the loooop, we'll go to where the cursor
			// is equal to the length of the string since
			// slice doesn't include the ending index
			while (cursor + 2 <= len) {
				// if the current position in the string looks
				// like the beginning of a translation string
				if (str.slice(cursor, cursor + 2) === '[[') {
					// split the string from the last break
					// to the character before the cursor
					// add that to the result array
					toTranslate.push(str.slice(lastBreak, cursor));
					// set the cursor position past the beginning
					// brackets of the translation string
					cursor += 2;
					// set the last break to our current
					// spot since we just broke the string
					lastBreak = cursor;

					// the current level of nesting of the translation strings
					var level = 0;
					var sliced;

					while (cursor + 2 <= len) {
						sliced = str.slice(cursor, cursor + 2);
						// if we're at the beginning of another translation string,
						// we're nested, so add to our level
						if (sliced === '[[') {
							level += 1;
							cursor += 2;
						// if we're at the end of a translation string
						} else if (sliced === ']]') {
							// if we're at the base level, then this is the end
							if (level === 0) {
								// so grab the name and args
								var result = split(str.slice(lastBreak, cursor));
								var name = result[0];
								var args = result.slice(1);

								// add the translation promise to the array
								toTranslate.push(this.translateKey(name, args));
								// skip past the ending brackets
								cursor += 2;
								// set this as our last break
								lastBreak = cursor;
								// and we're no longer in a translation string,
								// so continue with the main loop
								break;
							}
							// otherwise we lower the level
							level -= 1;
							// and skip past the ending brackets
							cursor += 2;
						} else {
							// otherwise just move to the next character
							cursor += 1;
						}
					}
				}
				// move to the next character
				cursor += 1;
			}

			// add the remaining text after the last translation string
			toTranslate.push(str.slice(lastBreak, cursor + 2));

			// and return a promise for the concatenated translated string
			return Promise.all(toTranslate).then(function (translated) {
				return translated.join('');
			});
		};

		/**
		 * Translates a specific key and array of arguments
		 * @param {string} name - Translation key (ex. 'global:home')
		 * @param {string[]} args - Arguments for `%1`, `%2`, etc
		 * @returns {Promise<string>}
		 */
		Translator.prototype.translateKey = function translateKey(name, args) {
			var self = this;

			var result = name.split(':', 2);
			var namespace = result[0];
			var key = result[1];

			var translation = this.getTranslation(namespace, key);
			var argsToTranslate = args.map(function (arg) {
				return string(arg).collapseWhitespace().decodeHTMLEntities().escapeHTML().s;
			}).map(function (arg) {
				return self.translate(arg);
			});

			// so we can await all promises at once
			argsToTranslate.unshift(translation);

			return Promise.all(argsToTranslate).then(function (result) {
				var translated = result[0];
				var translatedArgs = result.slice(1);

				if (!translated) {
					return key;
				}
				var out = translated;
				translatedArgs.forEach(function (arg, i) {
					out = out.replace(new RegExp('%' + (i + 1), 'g'), arg);
				});
				return out;
			});
		};

		/**
		 * Load translation file (or use a cached version), and optionally return the translation of a certain key
		 * @param {string} namespace - The file name of the translation namespace
		 * @param {string} [key] - The key of the specific translation to getJSON
		 * @returns {Promise<Object|string>}
		 */
		Translator.prototype.getTranslation = function getTranslation(namespace, key) {
			var translation;
			if (!namespace) {
				console.warn('[translator] Parameter `namespace` is ' + namespace + (namespace === '' ? '(empty string)' : ''));
				translation = Promise.resolve({});
			} else if (this.translations[namespace]) {
				translation = this.translations[namespace];
			} else {
				translation = this.load(this.lang, namespace);
				this.translations[namespace] = translation;
			}

			if (key) {
				return translation.then(function (x) {
					return x[key];
				});
			}
			return translation;
		};

		/**
		 * Get the language of the current environment, falling back to defaults
		 * @returns {string}
		 */
		Translator.getLanguage = function getLanguage() {
			var lang;

			if (typeof window === 'object' && window.config && window.utils) {
				lang = utils.params().lang || config.userLang || config.defaultLang || 'en_GB';
			} else {
				var meta = require('../../../src/meta');
				lang = meta.config.defaultLang || 'en_GB';
			}

			return lang;
		};

		/**
		 * Create and cache a new Translator instance, or return a cached one
		 * @param {string} [language] - ('en_GB') Language string
		 * @returns {Translator}
		 */
		Translator.create = function create(language) {
			if (!language) {
				language = Translator.getLanguage();
			}

			Translator.cache[language] = Translator.cache[language] || new Translator(language);

			return Translator.cache[language];
		};

		Translator.cache = {};

		return Translator;
	}();

	var adaptor = {
		/**
		 * The Translator class
		 */
		Translator: Translator,

		/**
		 * Legacy translator function for backwards compatibility
		 */
		translate: function translate(text, language, callback) {
			// console.warn('[translator] `translator.translate(text, [lang, ]callback)` is deprecated. ' +
			//   'Use the `translator.Translator` class instead.');

			var cb = callback;
			var lang = language;
			if (typeof language === 'function') {
				cb = language;
				lang = null;
			}

			if (!(typeof text === 'string' || text instanceof String) || text === '') {
				return cb('');
			}

			Translator.create(lang).translate(text).then(function (output) {
				return cb(output);
			}).catch(function (err) {
				console.error('Translation failed: ' + err.stack);
			});
		},

		/**
		 * Construct a translator pattern
		 * @param {string} name - Translation name
		 * @param {string[]} args - Optional arguments for the pattern
		 */
		compile: function compile() {
			var args = Array.prototype.slice.call(arguments, 0);

			return '[[' + args.join(', ') + ']]';
		},

		/**
		 * Escape translation patterns from text
		 */
		escape: function escape(text) {
			return typeof text === 'string' ? text.replace(/\[\[([\S]*?)\]\]/g, '\\[\\[$1\\]\\]') : text;
		},

		/**
		 * Unescape translation patterns from text
		 */
		unescape: function unescape(text) {
			return typeof text === 'string' ? text.replace(/\\\[\\\[([\S]*?)\\\]\\\]/g, '[[$1]]') : text;
		},

		/**
		 * Add translations to the cache
		 */
		addTranslation: function addTranslation(language, filename, translation) {
			Translator.create(language).getTranslation(filename).then(function (translations) {
				assign(translations, translation);
			});
		},

		/**
		 * Get the translations object
		 */
		getTranslations: function getTranslations(language, filename, callback) {
			callback = callback || function () {};
			Translator.create(language).getTranslation(filename).then(callback);
		},

		/**
		 * Alias of getTranslations
		 */
		load: function load(language, filename, callback) {
			adaptor.getTranslations(language, filename, callback);
		},

		/**
		 * Get the language of the current environment, falling back to defaults
		 */
		getLanguage: Translator.getLanguage,

		toggleTimeagoShorthand: function toggleTimeagoShorthand() {
			var tmp = assign({}, jQuery.timeago.settings.strings);
			jQuery.timeago.settings.strings = assign({}, adaptor.timeagoShort);
			adaptor.timeagoShort = assign({}, tmp);
		},
		prepareDOM: function prepareDOM() {
			// Load the appropriate timeago locale file,
			// and correct NodeBB language codes to timeago codes, if necessary
			var languageCode = void 0;
			switch (config.userLang) {
				case 'en_GB':
				case 'en_US':
					languageCode = 'en';
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

			jQuery.getScript(RELATIVE_PATH + '/vendor/jquery/timeago/locales/jquery.timeago.' + languageCode + '.js').done(function () {
				jQuery('.timeago').timeago();
				adaptor.timeagoShort = assign({}, jQuery.timeago.settings.strings);

				// Retrieve the shorthand timeago values as well
				jQuery.getScript(RELATIVE_PATH + '/vendor/jquery/timeago/locales/jquery.timeago.' + languageCode + '-short.js').done(function () {
					// Switch back to long-form
					adaptor.toggleTimeagoShorthand();
				});
			});

			// Add directional code if necessary
			adaptor.translate('[[language:dir]]', function (value) {
				if (value) {
					jQuery('html').css('direction', value).attr('data-dir', value);
				}
			});
		}
	};

	return adaptor;
});
