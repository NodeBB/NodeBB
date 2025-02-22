'use strict';

module.exports = function (utils, load, warn) {
	const assign = Object.assign || jQuery.extend;

	function escapeHTML(str) {
		return utils.escapeHTML(utils.decodeHTMLEntities(
			String(str)
				.replace(/[\s\xa0]+/g, ' ')
				.replace(/^\s+|\s+$/g, '')
		));
	}

	const Translator = (function () {
		/**
		 * Construct a new Translator object
		 * @param {string} language - Language code for this translator instance
		 * @exports translator.Translator
		 */
		function Translator(language) {
			const self = this;

			if (!language) {
				throw new TypeError('Parameter `language` must be a language string. Received ' + language + (language === '' ? '(empty string)' : ''));
			}

			self.modules = Object.keys(Translator.moduleFactories).map(function (namespace) {
				const factory = Translator.moduleFactories[namespace];
				return [namespace, factory(language)];
			}).reduce(function (prev, elem) {
				const namespace = elem[0];
				const module = elem[1];
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
			const validText = 'a-zA-Z0-9\\-_.\\/';
			const validTextRegex = new RegExp('[' + validText + ']');
			const invalidTextRegex = new RegExp('[^' + validText + '\\]]');

			// current cursor position
			let cursor = 0;
			// last break of the input string
			let lastBreak = 0;
			// length of the input string
			const len = str.length;
			// array to hold the promises for the translations
			// and the strings of untranslated text in between
			const toTranslate = [];

			// to store the state of if we're currently in a top-level token for later
			let inToken = false;

			// split a translator string into an array of tokens
			// but don't split by commas inside other translator strings
			function split(text) {
				const len = text.length;
				const arr = [];
				let i = 0;
				let brk = 0;
				let level = 0;

				while (i + 2 <= len) {
					if (text[i] === '[' && text[i + 1] === '[') {
						level += 1;
						i += 1;
					} else if (text[i] === ']' && text[i + 1] === ']') {
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

			// move to the first [[
			cursor = str.indexOf('[[', cursor);

			// the loooop, we'll go to where the cursor
			// is equal to the length of the string since
			// slice doesn't include the ending index
			while (cursor + 2 <= len && cursor !== -1) {
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
				// we're in a token now
				inToken = true;

				// the current level of nesting of the translation strings
				let level = 0;
				let char0;
				let char1;
				// validating the current string is actually a translation
				let textBeforeColonFound = false;
				let colonFound = false;
				let textAfterColonFound = false;
				let commaAfterNameFound = false;

				while (cursor + 2 <= len) {
					char0 = str[cursor];
					char1 = str[cursor + 1];
					// found some text after the double bracket,
					// so this is probably a translation string
					if (!textBeforeColonFound && validTextRegex.test(char0)) {
						textBeforeColonFound = true;
						cursor += 1;
					// found a colon, so this is probably a translation string
					} else if (textBeforeColonFound && !colonFound && char0 === ':') {
						colonFound = true;
						cursor += 1;
					// found some text after the colon,
					// so this is probably a translation string
					} else if (colonFound && !textAfterColonFound && validTextRegex.test(char0)) {
						textAfterColonFound = true;
						cursor += 1;
					} else if (textAfterColonFound && !commaAfterNameFound && char0 === ',') {
						commaAfterNameFound = true;
						cursor += 1;
					// a space or comma was found before the name
					// this isn't a translation string, so back out
					} else if (!(textBeforeColonFound && colonFound && textAfterColonFound && commaAfterNameFound) &&
							invalidTextRegex.test(char0)) {
						cursor += 1;
						lastBreak -= 2;
						// no longer in a token
						inToken = false;
						if (level > 0) {
							level -= 1;
						} else {
							break;
						}
					// if we're at the beginning of another translation string,
					// we're nested, so add to our level
					} else if (char0 === '[' && char1 === '[') {
						level += 1;
						cursor += 2;
					// if we're at the end of a translation string
					} else if (char0 === ']' && char1 === ']') {
						// if we're at the base level, then this is the end
						if (level === 0) {
							// so grab the name and args
							const currentSlice = str.slice(lastBreak, cursor);
							const result = split(currentSlice);
							const name = result[0];
							const args = result.slice(1);

							// make a backup based on the raw string of the token
							// if there are arguments to the token
							let backup = '';
							if (args && args.length) {
								backup = this.translate(currentSlice);
							}
							// add the translation promise to the array
							toTranslate.push(this.translateKey(name, args, backup));
							// skip past the ending brackets
							cursor += 2;
							// set this as our last break
							lastBreak = cursor;
							// and we're no longer in a translation string,
							// so continue with the main loop
							inToken = false;
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

				// skip to the next [[
				cursor = str.indexOf('[[', cursor);
			}

			// ending string of source
			let last = str.slice(lastBreak);

			// if we were mid-token, treat it as invalid
			if (inToken) {
				last = this.translate(last);
			}

			// add the remaining text after the last translation string
			toTranslate.push(last);

			// and return a promise for the concatenated translated string
			return Promise.all(toTranslate).then(function (translated) {
				return translated.join('');
			});
		};

		/**
		 * Translates a specific key and array of arguments
		 * @param {string} name - Translation key (ex. 'global:home')
		 * @param {string[]} args - Arguments for `%1`, `%2`, etc
		 * @param {string|Promise<string>} backup - Text to use in case the key can't be found
		 * @returns {Promise<string>}
		 */
		Translator.prototype.translateKey = function translateKey(name, args, backup) {
			const self = this;

			const result = name.split(':', 2);
			const namespace = result[0];
			const key = result[1];

			if (self.modules[namespace]) {
				return Promise.resolve(self.modules[namespace](key, args));
			}

			if (namespace && result.length === 1) {
				return Promise.resolve('[[' + namespace + ']]');
			}

			if (namespace && !key) {
				warn('Missing key in translation token "' + name + '" for language "' + self.lang + '"');
				return Promise.resolve('[[' + namespace + ']]');
			}

			const translation = this.getTranslation(namespace, key);
			return translation.then(function (translated) {
				// check if the translation is missing first
				if (!translated) {
					warn('Missing translation "' + name + '" for language "' + self.lang + '"');
					return backup || key;
				}

				const argsToTranslate = args.map(function (arg) {
					return self.translate(escapeHTML(arg));
				});

				return Promise.all(argsToTranslate).then(function (translatedArgs) {
					let out = translated;
					translatedArgs.forEach(function (arg, i) {
						let escaped = `<bdi>${arg.replace(/%(?=\d)/g, '&#37;').replace(/\\,/g, '&#44;')}</bdi>`;
						// fix double escaped translation keys, see https://github.com/NodeBB/NodeBB/issues/9206
						escaped = escaped.replace(/&amp;lsqb;/g, '&lsqb;')
							.replace(/&amp;rsqb;/g, '&rsqb;');
						out = out.replace(new RegExp('%' + (i + 1), 'g'), escaped);
					});
					return out;
				});
			});
		};

		/**
		 * Load translation file (or use a cached version), and optionally return the translation of a certain key
		 * @param {string} namespace - The file name of the translation namespace
		 * @param {string} [key] - The key of the specific translation to getJSON
		 * @returns {Promise<{ [key: string]: string } | string>}
		 */
		Translator.prototype.getTranslation = function getTranslation(namespace, key) {
			let translation;
			if (!namespace) {
				warn('[translator] Parameter `namespace` is ' + namespace + (namespace === '' ? '(empty string)' : ''));
				translation = Promise.resolve({});
			} else {
				this.translations[namespace] = this.translations[namespace] ||
					this.load(this.lang, namespace).catch(function () { return {}; });
				translation = this.translations[namespace];
			}

			if (key) {
				return translation.then(function (x) {
					if (typeof x[key] === 'string') return x[key];
					const keyParts = key.split('.');
					for (let i = 0; i <= keyParts.length; i++) {
						if (i === keyParts.length) {
							// default to trying to find key with the same name as parent or equal to empty string
							return x[keyParts[i - 1]] !== undefined ? x[keyParts[i - 1]] : x[''];
						}
						switch (typeof x[keyParts[i]]) {
							case 'object':
								x = x[keyParts[i]];
								break;
							case 'string':
								if (i === keyParts.length - 1) {
									return x[keyParts[i]];
								}

								return false;

							default:
								return false;
						}
					}
				});
			}
			return translation;
		};

		/**
		 * @param {Node} node
		 * @returns {Node[]}
		 */
		function descendantTextNodes(node) {
			const textNodes = [];

			function helper(node) {
				if (node.nodeType === 3) {
					textNodes.push(node);
				} else {
					for (let i = 0, c = node.childNodes, l = c.length; i < l; i += 1) {
						helper(c[i]);
					}
				}
			}

			helper(node);
			return textNodes;
		}

		/**
		 * Recursively translate a DOM element in place
		 * @param {Element} element - Root element to translate
		 * @param {string[]} [attributes] - Array of node attributes to translate
		 * @returns {Promise<void>}
		 */
		Translator.prototype.translateInPlace = function translateInPlace(element, attributes) {
			attributes = attributes || ['placeholder', 'title'];

			const nodes = descendantTextNodes(element);
			const text = nodes.map(function (node) {
				return utils.escapeHTML(node.nodeValue);
			}).join('  ||  ');

			const attrNodes = attributes.reduce(function (prev, attr) {
				const tuples = Array.prototype.map.call(element.querySelectorAll('[' + attr + '*="[["]'), function (el) {
					return [attr, el];
				});
				return prev.concat(tuples);
			}, []);
			const attrText = attrNodes.map(function (node) {
				return node[1].getAttribute(node[0]);
			}).join('  ||  ');

			return Promise.all([
				this.translate(text),
				this.translate(attrText),
			]).then(function (ref) {
				const translated = ref[0];
				const translatedAttrs = ref[1];
				if (translated) {
					translated.split('  ||  ').forEach(function (html, i) {
						$(nodes[i]).replaceWith(html);
					});
				}
				if (translatedAttrs) {
					translatedAttrs.split('  ||  ').forEach(function (text, i) {
						attrNodes[i][1].setAttribute(attrNodes[i][0], text);
					});
				}
			});
		};

		/**
		 * Get the language of the current environment, falling back to defaults
		 * @returns {string}
		 */
		Translator.getLanguage = function getLanguage() {
			return utils.getLanguage();
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
				const translator = Translator.cache[key];
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
			const len = text.length;
			let cursor = 0;
			let lastBreak = 0;
			let level = 0;
			let out = '';
			let sub;

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
			return typeof text === 'string' ?
				text.replace(/\[\[/g, '&lsqb;&lsqb;').replace(/\]\]/g, '&rsqb;&rsqb;') :
				text;
		};

		/**
		 * Unescape escaped translator patterns in text
		 * @param {string} text
		 * @returns {string}
		 */
		Translator.unescape = function unescape(text) {
			return typeof text === 'string' ?
				text.replace(/&rsqb;&rsqb;/g, ']]').replace(/&lsqb;&lsqb;/g, '[[') :
				text;
		};

		/**
		 * Construct a translator pattern
		 * @param {string} name - Translation name
		 * @param {...string} arg - Optional argument for the pattern
		 */
		Translator.compile = function compile() {
			const args = Array.prototype.slice.call(arguments, 0).map(function (text) {
				// escape commas and percent signs in arguments
				return String(text).replace(/%/g, '&#37;').replace(/,/g, '&#44;');
			});

			return '[[' + args.join(', ') + ']]';
		};

		return Translator;
	}());

	/**
	 * @exports translator
	 */
	const adaptor = {
		/**
		 * The Translator class
		 */
		Translator: Translator,

		compile: Translator.compile,
		escape: Translator.escape,
		unescape: Translator.unescape,
		getLanguage: Translator.getLanguage,

		flush: function () {
			Object.keys(Translator.cache).forEach(function (code) {
				Translator.cache[code].translations = {};
			});
		},

		flushNamespace: function (namespace) {
			Object.keys(Translator.cache).forEach(function (code) {
				if (Translator.cache[code] &&
					Translator.cache[code].translations &&
					Translator.cache[code].translations[namespace]
				) {
					Translator.cache[code].translations[namespace] = null;
				}
			});
		},


		/**
		 * Legacy translator function for backwards compatibility
		 */
		translate: function translate(text, language, callback) {
			// TODO: deprecate?

			let cb = callback;
			let lang = language;
			if (typeof language === 'function') {
				cb = language;
				lang = null;
			}

			if (!(typeof text === 'string' || text instanceof String) || text === '') {
				if (cb) {
					return setTimeout(cb, 0, '');
				}
				return '';
			}

			return Translator.create(lang).translate(text).then(function (output) {
				if (cb) {
					setTimeout(cb, 0, output);
				}
				return output;
			}, function (err) {
				warn('Translation failed: ' + err.stack);
			});
		},
		translateKeys: async function (keys, language, callback) {
			let cb = callback;
			let lang = language;
			if (typeof language === 'function') {
				cb = language;
				lang = null;
			}
			const translations = await Promise.all(keys.map(key => adaptor.translate(key, lang)));
			if (typeof cb === 'function') {
				return setTimeout(cb, 0, translations);
			}
			return translations;
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

		toggleTimeagoShorthand: function toggleTimeagoShorthand(callback) {
			/* eslint "prefer-object-spread": "off" */
			function toggle() {
				const tmp = assign({}, jQuery.timeago.settings.strings);
				jQuery.timeago.settings.strings = assign({}, adaptor.timeagoShort);
				adaptor.timeagoShort = assign({}, tmp);
				if (typeof callback === 'function') {
					callback();
				}
			}

			if (!adaptor.timeagoShort) {
				let languageCode = utils.userLangToTimeagoCode(config.userLang);
				if (!config.timeagoCodes.includes(languageCode + '-short')) {
					languageCode = 'en';
				}

				const originalSettings = assign({}, jQuery.timeago.settings.strings);
				adaptor.switchTimeagoLanguage(languageCode + '-short', function () {
					adaptor.timeagoShort = assign({}, jQuery.timeago.settings.strings);
					jQuery.timeago.settings.strings = assign({}, originalSettings);
					toggle();
				});
			} else {
				toggle();
			}
		},

		switchTimeagoLanguage: function switchTimeagoLanguage(langCode, callback) {
			// Delete the cached shorthand strings if present
			delete adaptor.timeagoShort;
			import(/* webpackChunkName: "timeago/[request]" */ 'timeago/locales/jquery.timeago.' + langCode).then(callback);
		},
	};

	return adaptor;
};
