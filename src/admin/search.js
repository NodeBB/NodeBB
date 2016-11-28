'use strict';

var fs = require('fs');
var path = require('path');
var nconf = require('nconf');
var sanitize = require('sanitize-html');

var languages = require('../languages');
var meta = require('../meta');
var utils = require('../../public/src/utils');

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

function loadLanguage(language, filename) {
	return new Promise(function (resolve, reject) {
		languages.get(language, filename + '.json', function (err, data) {
			if (err || !data || !Object.keys(data).length) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});
}

function getAdminNamespaces() {
	return walk(path.resolve('./public/templates/admin'))
		.then(function (directories) {
			return directories.map(function (dir) {
				return dir.replace(/^.*(admin.*?).tpl$/, '$1');
			}).filter(function (dir) {
				return !dir.includes('/partials/');
			}).filter(function (dir) {
				return dir.match(/\/.*\//);
			});
		});
}

var fallbackCache = {};

function removeTranslatorPatterns(str) {
	var len = str.len;
	var cursor = 0;
	var lastBreak = 0;
	var level = 0;
	var out = '';
	var sub;

	while (cursor < len) {
		sub = str.slice(cursor, cursor + 2);
		if (sub === '[[') {
			if (level === 0) {
				out += str.slice(lastBreak, cursor);
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
	out += str.slice(lastBreak, cursor);
	return out;
}

function fallback(namespace) {
	fallbackCache[namespace] = fallbackCache[namespace] ||
		readFile(path.resolve('./public/templates/', namespace + '.tpl'))
			.then(function (template) {
				// reduce the template to just meaningful text
				// remove scripts, etc and replace all tags with divs
				var translations = sanitize(template, {
					transformTags: {
						'*': function () {
							return {
								tagName: 'div'
							};
						}
					}
				})
					// remove all html tags, templating stuff, and translation strings
					.replace(/(?:<div>)|(?:<\/div>)|(?:\{[^\{\}]*\})/g, '')
					// collapse whitespace
					.replace(/([\n\r]+ ?)+/g, '\n')
					.replace(/[\t ]+/g, ' ');
				
				translations = removeTranslatorPatterns(translations);
				
				return {
					namespace: namespace,
					translations: translations,
				};
			});
	
	return fallbackCache[namespace];
}

function initDict(language) {
	return getAdminNamespaces().then(function (namespaces) {
		return Promise.all(namespaces.map(function (namespace) {
			return loadLanguage(language, namespace).then(function (translations) {
				return { namespace: namespace, translations: translations };
			}).then(function (params) {
				var namespace = params.namespace;
				var translations = params.translations;

				var str = Object.keys(translations).map(function (key) {
					return translations[key];
				}).join('\n');

				return {
					namespace: namespace,
					translations: str
				};
			})
			// TODO: Use translator to get title for admin route?
			.catch(function () {
				return fallback(namespace);
			})
			.catch(function () {
				return { namespace: namespace, translations: '' };
			});
		}));
	});
}

var cache = {};

function getDict(language, term) {
	cache[language] = cache[language] || initDict(language);
	return cache[language];
}

module.exports.getDict = getDict;
