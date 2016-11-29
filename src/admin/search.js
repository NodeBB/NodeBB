'use strict';

var fs = require('fs');
var path = require('path');
var sanitizeHTML = require('sanitize-html');

var languages = require('../languages');
var utils = require('../../public/src/utils');
var Translator = require('../../public/src/modules/translator').Translator;

function walk(directory) {
	return new Promise(function (resolve, reject) {
		utils.walk(directory, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
}

function readFile(path) {
	return new Promise(function (resolve, reject) {
		fs.readFile(path, function (err, data) {
			if (err) {
				reject(err);
			} else {
				resolve(data.toString());
			}
		});
	});
}

function loadLanguage(language, namespace) {
	return new Promise(function (resolve, reject) {
		languages.get(language, namespace, function (err, data) {
			if (err || !data || !Object.keys(data).length) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
}

function filterDirectories(directories) {
	return directories.map(function (dir) {
		// get the relative path
		return dir.replace(/^.*(admin.*?).tpl$/, '$1');
	}).filter(function (dir) {
		// exclude partials
		// only include subpaths
		return !dir.includes('/partials/') && /\/.*\//.test(dir);
	});
}

function getAdminNamespaces() {
	return walk(path.resolve(__dirname, '../../public/templates/admin'))
		.then(filterDirectories);
}

function sanitize(html) {
	// reduce the template to just meaningful text
	// remove all tags and strip out scripts, etc completely
	return sanitizeHTML(html, {
		allowedTags: [],
		allowedAttributes: [],
	});
}

function simplify(translations) {
	return translations
		// remove all mustaches
		.replace(/(?:\{{1,2}[^\}]*?\}{1,2})/g, '')
		// collapse whitespace
		.replace(/(?:[ \t]*[\n\r]+[ \t]*)+/g, '\n')
		.replace(/[\t ]+/g, ' ');
}

var fallbackCache = {};

function initFallback(namespace) {
	return readFile(path.resolve(__dirname, '../../public/templates/', namespace + '.tpl'))
		.then(function (template) {
			var translations = sanitize(template);
			translations = simplify(translations);
			translations = Translator.removePatterns(translations);

			return {
				namespace: namespace,
				translations: translations,
			};
		});
}

function fallback(namespace) {
	// use cache if exists, else make it
	fallbackCache[namespace] = fallbackCache[namespace] || initFallback(namespace);
	return fallbackCache[namespace];
}

function initDict(language) {
	return getAdminNamespaces().then(function (namespaces) {
		return Promise.all(namespaces.map(function (namespace) {
			return loadLanguage(language, namespace)
				.then(function (translations) {
					// join all translations into one string separated by newlines
					var str = Object.keys(translations).map(function (key) {
						return translations[key];
					}).join('\n');

					return {
						namespace: namespace,
						translations: str,
					};
				})
				// TODO: Use translator to get title for admin route?
				.catch(function () {
					// no translations for this route, fallback to template
					return fallback(namespace);
				})
				.catch(function () {
					// no fallback, just return blank
					return {
						namespace: namespace,
						translations: '',
					};
				});
		}));
	});
}

var cache = {};

function getDict(language) {
	// use cache if exists, else make it
	cache[language] = cache[language] || initDict(language);
	return cache[language];
}

module.exports.getDict = getDict;
module.exports.filterDirectories = filterDirectories;
module.exports.simplify = simplify;
module.exports.sanitize = sanitize;
