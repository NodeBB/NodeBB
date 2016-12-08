/* global define, jQuery, config, utils, window, Promise */

(function (factory) {
	'use strict';
	function loadClient(language, namespace) {
		return Promise.resolve(jQuery.getJSON(config.relative_path + '/api/language/' + language + '/' + encodeURIComponent(namespace)));
	}
	var warn = function () {};
	if (typeof config === 'object' && config.environment === 'development') {
		warn = console.warn.bind(console);
	}
	if (typeof define === 'function' && define.amd) {
		// AMD. Register as a named module
		define('translator', ['string'], function (string) {
			return factory(string, loadClient, warn);
		});
	} else if (typeof module === 'object' && module.exports) {
		// Node
		(function () {
			require('promise-polyfill');
			var languages = require('../../../src/languages');

			if (global.env === 'development') {
				var winston = require('winston');
				warn = function (a) {
					winston.warn(a);
				};
			}

			function loadServer(language, namespace) {
				return new Promise(function (resolve, reject) {
					languages.get(language, namespace, function (err, data) {
						if (err) {
							reject(err);
						} else {
							resolve(data);
						}
					});
				});
			}

			module.exports = factory(require('string'), loadServer, warn);
		}());
	} else {
		window.translator = factory(window.string, loadClient, warn);
	}
}(function (string, load, warn) {
	'use strict';
	var assign = Object.assign || jQuery.extend;
	function classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

	var Translator = (function () {
		/**
		 * Construct a new Translator object
		 * @param {string} language - Language code for this translator instance
		 */
		function Translator(language) {
			var self = this;
			classCallCheck(self, Translator);

			if (!language) {
				throw new TypeError('Parameter `language` must be a language string. Received ' + language + (language === '' ? '(empty string)' : ''));
			}

			self.modules = Object.keys(Translator.moduleFactories).map(function (namespace) {
				var factory = Translator.moduleFactories[namespace];
				return [namespace, factory(language)];
			}).reduce(function (prev, elem) {
				var namespace = elem[0];
				var module = elem[1];
				prev[namespace] = module;

				return prev;
			}, {});

			self.lang = language;
			self.translations = {};
		}

		Translator.prototype.load = load;

		/**
		 * Parse the translation instructions into the language of the Translator instance
		 * @param {string} str - Source string
		 * @returns {Promise<string>}
		 */
		Translator.prototype.translate = function translate(str) {
			// regex for valid text in namespace / key
			var validText = 'a-zA-Z0-9\\-_.\\/';
			var validTextRegex = new RegExp('[' + validText + ']');
			var invalidTextRegex = new RegExp('[^' + validText + '\\]]');

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
					} else if (level === 0 && text[i] === ',' && text[i - 1] !== '\\') {
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
					// validating the current string is actually a translation
					var textBeforeColonFound = false;
					var colonFound = false;
					var textAfterColonFound = false;
					var commaAfterNameFound = false;

					while (cursor + 2 <= len) {
						sliced = str.slice(cursor, cursor + 2);
						// found some text after the double bracket, 
						// so this is probably a translation string
						if (!textBeforeColonFound && validTextRegex.test(sliced[0])) {
							textBeforeColonFound = true;
							cursor += 1;
						// found a colon, so this is probably a translation string
						} else if (textBeforeColonFound && !colonFound && sliced[0] === ':') {
							colonFound = true;
							cursor += 1;
						// found some text after the colon,
						// so this is probably a translation string
						} else if (colonFound && !textAfterColonFound && validTextRegex.test(sliced[0])) {
							textAfterColonFound = true;
							cursor += 1;
						} else if (textAfterColonFound && !commaAfterNameFound && sliced[0] === ',') {
							commaAfterNameFound = true;
							cursor += 1;
						// a space or comma was found before the name
						// this isn't a translation string, so back out
						} else if (!(textBeforeColonFound && colonFound && textAfterColonFound && commaAfterNameFound) && 
								invalidTextRegex.test(sliced[0])) {
							cursor += 1;
							lastBreak -= 2;
							if (level > 0) {
								level -= 1;
							} else {
								break;
							}
						// if we're at the beginning of another translation string,
						// we're nested, so add to our level
						} else if (sliced === '[[') {
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

			if (self.modules[namespace]) {
				return Promise.resolve(self.modules[namespace](key, args));
			}

			if (namespace && !key) {
				warn('Missing key in translation token "' + name + '"');
				return Promise.resolve('[[' + namespace + ']]');
			}

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
					warn('Missing translation "' + name + '"');
					return key;
				}
				var out = translated;
				translatedArgs.forEach(function (arg, i) {
					var escaped = arg.replace(/%/g, '&#37;').replace(/\\,/g, '&#44;');
					out = out.replace(new RegExp('%' + (i + 1), 'g'), escaped);
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
				warn('[translator] Parameter `namespace` is ' + namespace + (namespace === '' ? '(empty string)' : ''));
				translation = Promise.resolve({});
			} else {
				translation = this.translations[namespace] = this.translations[namespace] || this.load(this.lang, namespace);
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
				lang = utils.params().lang || config.userLang || config.defaultLang || 'en-GB';
			} else {
				var meta = require('../../../src/meta');
				lang = meta.config.defaultLang || 'en-GB';
			}

			return lang;
		};

		/**
		 * Create and cache a new Translator instance, or return a cached one
		 * @param {string} [language] - ('en-GB') Language string
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

		/**
		 * Register a custom module to handle translations
		 * @param {string} namespace - Namespace to handle translation for
		 * @param {Function} factory - Function to return the translation function for this namespace
		 */
		Translator.registerModule = function registerModule(namespace, factory) {
			Translator.moduleFactories[namespace] = factory;

			Object.keys(Translator.cache).forEach(function (key) {
				var translator = Translator.cache[key];
				translator.modules[namespace] = factory(translator.lang);
			});
		};

		Translator.moduleFactories = {};

		/**
		 * Remove the translator patterns from text
		 * @param {string} text
		 * @returns {string}
		 */
		Translator.removePatterns = function removePatterns(text) {
			var len = text.length;
			var cursor = 0;
			var lastBreak = 0;
			var level = 0;
			var out = '';
			var sub;

			while (cursor < len) {
				sub = text.slice(cursor, cursor + 2);
				if (sub === '[[') {
					if (level === 0) {
						out += text.slice(lastBreak, cursor);
					}
					level += 1;
					cursor += 2;
				} else if (sub === ']]') {
					level -= 1;
					cursor += 2;
					if (level === 0) {
						lastBreak = cursor;
					}
				} else {
					cursor += 1;
				}
			}
			out += text.slice(lastBreak, cursor);
			return out;
		};

		/**
		 * Escape translator patterns in text
		 * @param {string} text
		 * @returns {string}
		 */
		Translator.escape = function escape(text) {
			return typeof text === 'string' ? text.replace(/\[\[([\S]*?)\]\]/g, '\\[\\[$1\\]\\]') : text;
		};

		/**
		 * Unescape escaped translator patterns in text
		 * @param {string} text
		 * @returns {string}
		 */
		Translator.unescape = function unescape(text) {
			return typeof text === 'string' ? text.replace(/\\\[\\\[([\S]*?)\\\]\\\]/g, '[[$1]]') : text;
		};

		/**
		 * Construct a translator pattern
		 * @param {string} name - Translation name
		 * @param {...string} arg - Optional argument for the pattern
		 */
		Translator.compile = function compile() {
			var args = Array.prototype.slice.call(arguments, 0).map(function (text) {
				// escape commas and percent signs in arguments
				return text.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
			});

			return '[[' + args.join(', ') + ']]';
		};

		return Translator;
	}());

	var adaptor = {
		/**
		 * The Translator class
		 */
		Translator: Translator,

		compile: Translator.compile,
		escape: Translator.escape,
		unescape: Translator.unescape,
		getLanguage: Translator.getLanguage,

		/**
		 * Legacy translator function for backwards compatibility
		 */
		translate: function translate(text, language, callback) {
			// TODO: deprecate?

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
				warn('Translation failed: ' + err.stack);
			});
		},

		/**
		 * Add translations to the cache
		 */
		addTranslation: function addTranslation(language, namespace, translation) {
			Translator.create(language).getTranslation(namespace).then(function (translations) {
				assign(translations, translation);
			});
		},

		/**
		 * Get the translations object
		 */
		getTranslations: function getTranslations(language, namespace, callback) {
			callback = callback || function () {};
			Translator.create(language).getTranslation(namespace).then(callback);
		},

		/**
		 * Alias of getTranslations
		 */
		load: function load(language, namespace, callback) {
			adaptor.getTranslations(language, namespace, callback);
		},

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
				case 'en-GB':
				case 'en-US':
					languageCode = 'en';
					break;

				case 'fa-IR':
					languageCode = 'fa';
					break;

				case 'pt-BR':
					languageCode = 'pt-br';
					break;

				case 'nb':
					languageCode = 'no';
					break;

				default:
					languageCode = config.userLang;
					break;
			}

			jQuery.getScript(config.relative_path + '/vendor/jquery/timeago/locales/jquery.timeago.' + languageCode + '.js').done(function () {
				jQuery('.timeago').timeago();
				adaptor.timeagoShort = assign({}, jQuery.timeago.settings.strings);

				// Retrieve the shorthand timeago values as well
				jQuery.getScript(config.relative_path + '/vendor/jquery/timeago/locales/jquery.timeago.' + languageCode + '-short.js').done(function () {
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
}));
