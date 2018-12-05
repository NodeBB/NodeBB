'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var sanitizeHTML = require('sanitize-html');
var nconf = require('nconf');

var file = require('../file');
var Translator = require('../translator').Translator;

function filterDirectories(directories) {
	return directories.map(function (dir) {
		// get the relative path
		return dir.replace(/^.*(admin.*?).tpl$/, '$1');
	}).filter(function (dir) {
		// exclude .js files
		// exclude partials
		// only include subpaths
		// exclude category.tpl, group.tpl, category-analytics.tpl
		return !dir.endsWith('.js') &&
			!dir.includes('/partials/') &&
			/\/.*\//.test(dir) &&
			!/manage\/(category|group|category-analytics)$/.test(dir);
	});
}

function getAdminNamespaces(callback) {
	file.walk(path.resolve(nconf.get('views_dir'), 'admin'), function (err, directories) {
		if (err) {
			return callback(err);
		}

		callback(null, filterDirectories(directories));
	});
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
		.replace(/(?:\{{1,2}[^}]*?\}{1,2})/g, '')
		// collapse whitespace
		.replace(/(?:[ \t]*[\n\r]+[ \t]*)+/g, '\n')
		.replace(/[\t ]+/g, ' ');
}

function nsToTitle(namespace) {
	return namespace.replace('admin/', '').split('/').map(function (str) {
		return str[0].toUpperCase() + str.slice(1);
	}).join(' > ')
		.replace(/[^a-zA-Z> ]/g, ' ');
}

var fallbackCacheInProgress = {};
var fallbackCache = {};

function initFallback(namespace, callback) {
	fs.readFile(path.resolve(nconf.get('views_dir'), namespace + '.tpl'), 'utf8', function (err, template) {
		if (err) {
			return callback(err);
		}

		var title = nsToTitle(namespace);

		var translations = sanitize(template);
		translations = Translator.removePatterns(translations);
		translations = simplify(translations);
		translations += '\n' + title;

		callback(null, {
			namespace: namespace,
			translations: translations,
			title: title,
		});
	});
}

function fallback(namespace, callback) {
	if (fallbackCache[namespace]) {
		return callback(null, fallbackCache[namespace]);
	}
	if (fallbackCacheInProgress[namespace]) {
		return fallbackCacheInProgress[namespace].push(callback);
	}

	fallbackCacheInProgress[namespace] = [function (err, params) {
		if (err) {
			return callback(err);
		}

		callback(null, params);
	}];
	initFallback(namespace, function (err, params) {
		fallbackCacheInProgress[namespace].forEach(function (fn) {
			fn(err, params);
		});
		fallbackCacheInProgress[namespace] = null;
		fallbackCache[namespace] = params;
	});
}

function initDict(language, callback) {
	var translator = Translator.create(language);

	getAdminNamespaces(function (err, namespaces) {
		if (err) {
			return callback(err);
		}

		async.map(namespaces, function (namespace, cb) {
			async.waterfall([
				function (next) {
					translator.getTranslation(namespace).then(function (translations) {
						next(null, translations);
					}, next);
				},
				function (translations, next) {
					if (!translations || !Object.keys(translations).length) {
						return next(Error('No translations for ' + language + '/' + namespace));
					}

					// join all translations into one string separated by newlines
					var str = Object.keys(translations).map(function (key) {
						return translations[key];
					}).join('\n');
					str = sanitize(str);

					var title = namespace;
					if (/admin\/general\/dashboard$/.test(title)) {
						title = '[[admin/menu:general/dashboard]]';
					} else {
						title = title.match(/admin\/(.+?)\/(.+?)$/);
						title = '[[admin/menu:section-' +
							(title[1] === 'development' ? 'advanced' : title[1]) +
							']]' + (title[2] ? (' > [[admin/menu:' +
							title[1] + '/' + title[2] + ']]') : '');
					}

					translator.translate(title).then(function (title) {
						next(null, {
							namespace: namespace,
							translations: str + '\n' + title,
							title: title,
						});
					}).catch(err);
				},
			], function (err, params) {
				if (err) {
					return fallback(namespace, function (err, params) {
						if (err) {
							return cb(null, {
								namespace: namespace,
								translations: '',
							});
						}

						cb(null, params);
					});
				}

				cb(null, params);
			});
		}, callback);
	});
}

var cacheInProgress = {};
var cache = {};

function getDictionary(language, callback) {
	if (cache[language]) {
		return callback(null, cache[language]);
	}
	if (cacheInProgress[language]) {
		return cacheInProgress[language].push(callback);
	}

	cacheInProgress[language] = [function (err, params) {
		if (err) {
			return callback(err);
		}

		callback(null, params);
	}];
	initDict(language, function (err, params) {
		cacheInProgress[language].forEach(function (fn) {
			fn(err, params);
		});
		cacheInProgress[language] = null;
		cache[language] = params;
	});
}

module.exports.getDictionary = getDictionary;
module.exports.filterDirectories = filterDirectories;
module.exports.simplify = simplify;
module.exports.sanitize = sanitize;
