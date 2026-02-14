'use strict';

const fs = require('fs');
const path = require('path');
const sanitizeHTML = require('sanitize-html');
const nconf = require('nconf');
const winston = require('winston');

const file = require('../file');
const { Translator } = require('../translator');

function filterDirectories(directories) {
	return directories.map(
		// get the relative path
		// convert dir to use forward slashes
		dir => dir.replace(/^.*(admin.*?).tpl$/, '$1').split(path.sep).join('/')
	).filter(
		// exclude .js files
		// exclude partials
		// only include subpaths
		// exclude category.tpl, group.tpl, category-analytics.tpl
		dir => (
			!dir.endsWith('.js') &&
			!dir.includes('/partials/') &&
			/\/.*\//.test(dir) &&
			!/manage\/(category|group|category-analytics)$/.test(dir)
		)
	);
}

async function getAdminNamespaces() {
	const directories = await file.walk(path.resolve(nconf.get('views_dir'), 'admin'));
	return filterDirectories(directories);
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
	return namespace.replace('admin/', '').split('/').map(str => str[0].toUpperCase() + str.slice(1)).join(' > ')
		.replace(/[^a-zA-Z> ]/g, ' ');
}

const fallbackCache = {};

async function initFallback(namespace) {
	const template = await fs.promises.readFile(path.resolve(nconf.get('views_dir'), `${namespace}.tpl`), 'utf8');

	const title = nsToTitle(namespace);
	let translations = sanitize(template);
	translations = Translator.removePatterns(translations);
	translations = simplify(translations);
	translations += `\n${title}`;

	return {
		namespace: namespace,
		translations: translations,
		title: title,
	};
}

async function fallback(namespace) {
	if (fallbackCache[namespace]) {
		return fallbackCache[namespace];
	}

	const params = await initFallback(namespace);
	fallbackCache[namespace] = params;
	return params;
}

async function initDict(language) {
	const namespaces = await getAdminNamespaces();
	return await Promise.all(namespaces.map(ns => buildNamespace(language, ns)));
}

async function buildNamespace(language, namespace) {
	const translator = Translator.create(language);
	try {
		const translations = await translator.getTranslation(namespace);
		if (!translations || !Object.keys(translations).length) {
			return await fallback(namespace);
		}
		// join all translations into one string separated by newlines
		let str = Object.keys(translations).map(key => translations[key]).join('\n');
		str = sanitize(str);

		let title = namespace;
		title = title.match(/admin\/(.+?)\/(.+?)$/);
		title = `[[admin/menu:section-${
			title[1] === 'development' ? 'advanced' : title[1]
		}]]${title[2] ? (` > [[admin/menu:${
			title[1]}/${title[2]}]]`) : ''}`;

		title = await translator.translate(title);
		return {
			namespace: namespace,
			translations: `${str}\n${title}`,
			title: title,
		};
	} catch (err) {
		winston.error(err.stack);
		return {
			namespace: namespace,
			translations: '',
		};
	}
}

const cache = {};

async function getDictionary(language) {
	if (cache[language]) {
		return cache[language];
	}

	const params = await initDict(language);
	cache[language] = params;
	return params;
}

module.exports.getDictionary = getDictionary;
module.exports.filterDirectories = filterDirectories;
module.exports.simplify = simplify;
module.exports.sanitize = sanitize;

require('../promisify')(module.exports);
