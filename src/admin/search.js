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

function fallback(namespace) {
	fallbackCache[namespace] = fallbackCache[namespace] ||
		readFile(path.resolve('./public/templates/', namespace + '.tpl'))
			.then(function (template) {
				var translations = sanitize(template, {
					transformTags: {
						'*': function () {
							return {
								tagName: 'div'
							};
						}
					}
				})
					.replace(/(<div>)|(<\/div>)/g, '')
					.replace(/([\n\r]+ ?)+/g, '\n')
					.replace(/[\t ]+/g, ' ');
				
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
			})
			.then(function (params) {
				params.translations = params.translations.replace(/\{[^\{\}]*\}/g, '');
				return params;
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
