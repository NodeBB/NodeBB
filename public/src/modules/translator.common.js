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

	function fixDoubleEscaped(str) {
		// fix double escaped translation keys, see https://github.com/NodeBB/NodeBB/issues/9206
		return str.replace(/&amp;lsqb;/g, '&lsqb;')
			.replace(/&amp;rsqb;/g, '&rsqb;')
			.replace(/&amp;#44;/g, '&#44;');
	}

	// takes token '[[topic:moved-from, arg1, arg2]]' and
	// normalizes it to ['topic:moved-from', ['arg1', 'arg2']]
	function normalizeToken(token) {
		if (typeof token !== 'string' || token === '') {
			return [String(token), []];
		}
		if (token.startsWith('[[') && token.endsWith(']]')) {
			token = token.slice(2, -2);
		}
		const parts = split(token); // use same split as translator.translate
		if (parts.length === 0) {
			return [token.trim(), []];
		}
		const txToken = parts[0].trim();
		const args = parts.slice(1).map(part => part.trim());
		return [txToken, args];
	}

	// replaces %1, %2 in translation with args[0], args[1] respectively
	function replaceArguments(translation, args) {
		if (!Array.isArray(args) || args.length === 0) {
			return translation;
		}
		args.forEach((arg, index) => {
			const argEscaped = arg.replace(/%(?=\d)/g, '&#37;').replace(/\\,/g, '&#44;');
			translation = translation.split(`%${index + 1}`).join(argEscaped);
		});
		return validateHrefAttributes(translation);
	}

	function validateHrefAttributes(translated) {
		return translated.replace(/href\s*=\s*(["'])(.*?)\1/gi, (match, quote, href) => {
			return isSafeHref(href) ? match : 'href=""';
		});
	}

	function isSafeHref(href) {
		const normalizedHref = String(href).trim().toLowerCase();
		const isHttpUrl = normalizedHref.startsWith('https://') || normalizedHref.startsWith('http://');
		const isRelativeUrl = normalizedHref.startsWith('/') && !normalizedHref.startsWith('//');
		return isHttpUrl || isRelativeUrl;
	}

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

	/*
	turns
		`]] some text here [[namespace1:key1, arg1, arg2]] other text [[invalid]] test [[namespace2:key2]] [[invalid`;
	into
		[
			{ text: ']] some text here ', tx: false },
			{ text: '[[namespace1:key1, arg1, arg2]]', tx: true },
			{ text: ' other text [[invalid]] test ', tx: false },
			{ text: '[[namespace2:key2]]', tx: true },
			{ text: ' [[invalid', tx: false }
		]
	*/
	const TOKEN_VALIDATOR = /^\[\[[^[\]\s,]+:[^[\]\s,]+/;
	function parseTranslationString(str) {
		const results = [];
		let cursor = 0;
		let lastCut = 0;
		const len = str.length;

		while (cursor < len) {
			// jump directly to the next opening bracket
			const nextOpen = str.indexOf('[[', cursor);
			if (nextOpen === -1) break; // No more tokens, exit loop

			let depth = 1;
			let i = nextOpen + 2;
			let foundClose = false;

			while (i < len) {
				// jump from bracket to bracket instead of char to char
				const closeIdx = str.indexOf(']]', i);
				if (closeIdx === -1) {
					break; // Missing a closing bracket entirely
				}
				const openIdx = str.indexOf('[[', i);

				// If we found another '[[', and it's BEFORE the next ']]', we are nesting
				if (openIdx !== -1 && openIdx < closeIdx) {
					depth++;
					i = openIdx + 2;
				} else {
					// Otherwise, we are closing a bracket
					depth--;
					i = closeIdx + 2;

					// If depth hits 0, we found the end of the outer token!
					if (depth === 0) {
						foundClose = true;
						break;
					}
				}
			}

			if (foundClose) {
				const token = str.slice(nextOpen, i);
				// Validate the token format
				if (TOKEN_VALIDATOR.test(token)) {
					// Push leading normal text if it exists
					if (nextOpen > lastCut) {
						results.push({ text: str.slice(lastCut, nextOpen), tx: false });
					}
					// Push the valid token
					results.push({ text: token, tx: true });
					// Advance our cuts and cursors past this token
					lastCut = i;
					cursor = i;
					continue;
				}
			}

			// --- BACKTRACKING ---
			// If we get here, the token was unclosed OR invalid.
			// We simply move the cursor past the broken '[[' and let the outer loop try again.
			// The broken brackets will eventually just get sliced as normal text.
			cursor = nextOpen + 2;
		}

		// Catch any remaining text at the end of the string
		if (lastCut < len) {
			results.push({ text: str.slice(lastCut), tx: false });
		}

		return results;
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
			const tokens = parseTranslationString(str);
			return Promise.all(tokens.map(async (token) => {
				if (token.tx) {
					const [txToken, args] = normalizeToken(token.text);
					return await this.translateKey(txToken, args, token.text);
				}
				return token.text;
			})).then(translations => translations.join('')).catch(err => {
				warn('Translation failed: ' + err.stack);
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

			if (!namespace || (result.length === 1 || !key)) {
				return Promise.resolve(escapeHTML(backup || name));
			}

			const translation = this.getTranslation(namespace, key);
			return translation.then(function (translated) {
				// check if the translation is missing first
				if (!translated) {
					warn('Missing translation "' + name + '" for language "' + self.lang + '"');
					return escapeHTML(backup || name);
				}

				return self.txArgs(args).then(function (translatedArgs) {
					return replaceArguments(translated, translatedArgs);
				});
			});
		};

		// translate arguments
		Translator.prototype.txArgs = async function (args) {
			if (!Array.isArray(args) || args.length === 0) {
				return args;
			}

			return await Promise.all(args.map(async (arg) => {
				const escapedArg = fixDoubleEscaped(escapeHTML(arg));
				if (escapedArg.startsWith('[[') && escapedArg.endsWith(']]')) {
					const [txToken, args] = normalizeToken(escapedArg);
					return await this.translateKey(txToken, args);
				}
				return escapedArg;
			}));
		},

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
			/*
				if (typeof text !== 'string') return text;

				let previous;
				// Keep matching the innermost unescaped brackets and converting them
				while (text !== previous) {
					previous = text;
					text = text.replace(/\[\[([a-zA-Z0-9_.-]+:[^\[\]]+)\]\]/g, '&lsqb;&lsqb;$1&rsqb;&rsqb;');
				}
				return text;
			*/
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
			/*
				if (typeof text !== 'string') return text;

				let previous;
				// Keep matching the innermost escaped brackets and converting them back
				while (text !== previous) {
					previous = text;
					text = text.replace(/&lsqb;&lsqb;([a-zA-Z0-9_.-]+:(?:(?!&lsqb;|&rsqb;).)+)&rsqb;&rsqb;/g, '[[$1]]');
				}
				return text;
			*/
		};

		/**
		 * Construct a translator pattern
		 * @param {string} name - Translation name
		 * @param {...string} arg - Optional argument for the pattern
		 */
		Translator.compile = function compile(...args) {
			return `[[${args.map(Translator.escapeArg).join(', ')}]]`;
		};

		Translator.escapeArg = function (arg) {
			return String(arg).replace(/%/g, '&#37;').replace(/,/g, '&#44;');
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
		escapeArg: Translator.escapeArg,
		escapeHTML: escapeHTML,
		fixDoubleEscaped: fixDoubleEscaped,
		normalizeToken: normalizeToken,
		replaceArguments: replaceArguments,
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

		translateKeys: async function (data, language, callback) {
			if (!Array.isArray(data)) {
				throw new Error('[[error:invalid-data]]');
			}
			let cb = callback;
			let lang = language;
			if (typeof language === 'function') {
				cb = language;
				lang = null;
			}
			lang = lang || Translator.getLanguage();

			// convert old format([[topic:moved-from]]) to new format [token, args, language]
			data = data.map(key => (typeof key === 'string' ? [key, [], lang] : key));

			const translations = await Promise.all(data.map(async (item) => {
				const [token, itemArgs, language] = item;
				const [txToken, argsFromToken] = adaptor.normalizeToken(token);
				let args = itemArgs;
				if (Array.isArray(argsFromToken) && argsFromToken.length > 0) {
					args = argsFromToken;
				}
				const tokenLanguage = language || lang;
				return Translator.create(tokenLanguage).translateKey(txToken, args, token);
			}));
			if (typeof cb === 'function') {
				return setTimeout(cb, 0, translations);
			}
			return translations;
		},
		// single tx token '[[topic:moved-from]]'
		translateKey: async function (token, args, language) {
			const [translation] = await adaptor.translateKeys([[token, args, language]]);
			return translation;
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
