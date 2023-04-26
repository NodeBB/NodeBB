'use strict';

const _ = require('lodash');
const nconf = require('nconf');
const path = require('path');
const fs = require('fs');
const { mkdirp } = require('mkdirp');


const file = require('../file');
const Plugins = require('../plugins');
const { paths } = require('../constants');

const buildLanguagesPath = path.join(paths.baseDir, 'build/public/language');
const coreLanguagesPath = path.join(paths.baseDir, 'public/language');

async function getTranslationMetadata() {
	const paths = await file.walk(coreLanguagesPath);
	let languages = [];
	let namespaces = [];

	paths.forEach((p) => {
		if (!p.endsWith('.json')) {
			return;
		}

		const rel = path.relative(coreLanguagesPath, p).split(/[/\\]/);
		const language = rel.shift().replace('_', '-').replace('@', '-x-');
		const namespace = rel.join('/').replace(/\.json$/, '');

		if (!language || !namespace) {
			return;
		}

		languages.push(language);
		namespaces.push(namespace);
	});


	languages = _.union(languages, Plugins.languageData.languages).sort().filter(Boolean);
	namespaces = _.union(namespaces, Plugins.languageData.namespaces).sort().filter(Boolean);
	const configLangs = nconf.get('languages');
	if (process.env.NODE_ENV === 'development' && Array.isArray(configLangs) && configLangs.length) {
		languages = configLangs;
	}
	// save a list of languages to `${buildLanguagesPath}/metadata.json`
	// avoids readdirs later on
	await mkdirp(buildLanguagesPath);
	const result = {
		languages: languages,
		namespaces: namespaces,
	};
	await fs.promises.writeFile(path.join(buildLanguagesPath, 'metadata.json'), JSON.stringify(result));
	return result;
}

async function writeLanguageFile(language, namespace, translations) {
	const dev = process.env.NODE_ENV === 'development';
	const filePath = path.join(buildLanguagesPath, language, `${namespace}.json`);

	await mkdirp(path.dirname(filePath));
	await fs.promises.writeFile(filePath, JSON.stringify(translations, null, dev ? 2 : 0));
}

// for each language and namespace combination,
// run through core and all plugins to generate
// a full translation hash
async function buildTranslations(ref) {
	const { namespaces } = ref;
	const { languages } = ref;
	const plugins = _.values(Plugins.pluginsData).filter(plugin => typeof plugin.languages === 'string');

	const promises = [];

	namespaces.forEach((namespace) => {
		languages.forEach((language) => {
			promises.push(buildNamespaceLanguage(language, namespace, plugins));
		});
	});

	await Promise.all(promises);
}

async function buildNamespaceLanguage(lang, namespace, plugins) {
	const translations = {};
	// core first
	await assignFileToTranslations(translations, path.join(coreLanguagesPath, lang, `${namespace}.json`));

	await Promise.all(plugins.map(pluginData => addPlugin(translations, pluginData, lang, namespace)));

	if (Object.keys(translations).length) {
		await writeLanguageFile(lang, namespace, translations);
	}
}

async function addPlugin(translations, pluginData, lang, namespace) {
	// if plugin doesn't have this namespace no need to continue
	if (pluginData.languageData && !pluginData.languageData.namespaces.includes(namespace)) {
		return;
	}

	const pathToPluginLanguageFolder = path.join(paths.nodeModules, pluginData.id, pluginData.languages);
	const defaultLang = pluginData.defaultLang || 'en-GB';

	// for each plugin, fallback in this order:
	//  1. correct language string (en-GB)
	//  2. old language string (en_GB)
	//  3. corrected plugin defaultLang (en-US)
	//  4. old plugin defaultLang (en_US)
	const langs = _.uniq([
		defaultLang.replace('-', '_').replace('-x-', '@'),
		defaultLang.replace('_', '-').replace('@', '-x-'),
		lang.replace('-', '_').replace('-x-', '@'),
		lang,
	]);

	for (const language of langs) {
		/* eslint-disable no-await-in-loop */
		await assignFileToTranslations(translations, path.join(pathToPluginLanguageFolder, language, `${namespace}.json`));
	}
}

async function assignFileToTranslations(translations, path) {
	try {
		const fileData = await fs.promises.readFile(path, 'utf8');
		Object.assign(translations, JSON.parse(fileData));
	} catch (err) {
		if (err.code !== 'ENOENT') {
			throw err;
		}
	}
}

exports.build = async function buildLanguages() {
	await fs.promises.rm(buildLanguagesPath, { recursive: true, force: true });
	const data = await getTranslationMetadata();
	await buildTranslations(data);
};
