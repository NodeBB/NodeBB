'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');

const db = require('../database');
const file = require('../file');

const Data = module.exports;

const basePath = path.join(__dirname, '../../');

Data.getPluginPaths = async function () {
	let plugins = await db.getSortedSetRange('plugins:active', 0, -1);
	plugins = plugins.filter(plugin => plugin && typeof plugin === 'string')
		.map(plugin => path.join(__dirname, '../../node_modules/', plugin));

	const exists = await Promise.all(plugins.map(p => file.exists(p)));
	return plugins.filter((p, i) => exists[i]);
};

Data.loadPluginInfo = async function (pluginPath) {
	const [packageJson, pluginJson] = await Promise.all([
		fs.promises.readFile(path.join(pluginPath, 'package.json'), 'utf8'),
		fs.promises.readFile(path.join(pluginPath, 'plugin.json'), 'utf8'),
	]);

	let pluginData;
	let packageData;
	try {
		pluginData = JSON.parse(pluginJson);
		packageData = JSON.parse(packageJson);

		pluginData.license = parseLicense(packageData);

		pluginData.id = packageData.name;
		pluginData.name = packageData.name;
		pluginData.description = packageData.description;
		pluginData.version = packageData.version;
		pluginData.repository = packageData.repository;
		pluginData.nbbpm = packageData.nbbpm;
		pluginData.path = pluginPath;
	} catch (err) {
		var pluginDir = path.basename(pluginPath);

		winston.error('[plugins/' + pluginDir + '] Error in plugin.json or package.json!', err.stack);
		throw new Error('[[error:parse-error]]');
	}
	return pluginData;
};

function parseLicense(packageData) {
	try {
		const licenseData = require('spdx-license-list/licenses/' + packageData.license);
		return {
			name: licenseData.name,
			text: licenseData.licenseText,
		};
	} catch (e) {
		// No license matched
		return null;
	}
}

Data.getActive = async function () {
	const pluginPaths = await Data.getPluginPaths();
	return await Promise.all(pluginPaths.map(p => Data.loadPluginInfo(p)));
};


Data.getStaticDirectories = async function (pluginData) {
	var validMappedPath = /^[\w\-_]+$/;

	if (!pluginData.staticDirs) {
		return;
	}

	const dirs = Object.keys(pluginData.staticDirs);
	if (!dirs.length) {
		return;
	}

	const staticDirs = {};

	async function processDir(route) {
		if (!validMappedPath.test(route)) {
			winston.warn('[plugins/' + pluginData.id + '] Invalid mapped path specified: ' +
				route + '. Path must adhere to: ' + validMappedPath.toString());
			return;
		}

		const dirPath = path.join(pluginData.path, pluginData.staticDirs[route]);
		try {
			const stats = await fs.promises.stat(dirPath);
			if (!stats.isDirectory()) {
				winston.warn('[plugins/' + pluginData.id + '] Mapped path \'' +
					route + ' => ' + dirPath + '\' is not a directory.');
				return;
			}

			staticDirs[pluginData.id + '/' + route] = dirPath;
		} catch (err) {
			if (err.code === 'ENOENT') {
				winston.warn('[plugins/' + pluginData.id + '] Mapped path \'' +
					route + ' => ' + dirPath + '\' not found.');
				return;
			}
			throw err;
		}
	}

	await Promise.all(dirs.map(route => processDir(route)));
	winston.verbose('[plugins] found ' + Object.keys(staticDirs).length +
			' static directories for ' + pluginData.id);
	return staticDirs;
};


Data.getFiles = async function (pluginData, type) {
	if (!Array.isArray(pluginData[type]) || !pluginData[type].length) {
		return;
	}

	winston.verbose('[plugins] Found ' + pluginData[type].length + ' ' + type + ' file(s) for plugin ' + pluginData.id);

	return pluginData[type].map(file => path.join(pluginData.id, file));
};

/**
 * With npm@3, dependencies can become flattened, and appear at the root level.
 * This method resolves these differences if it can.
 */
async function resolveModulePath(basePath, modulePath) {
	const isNodeModule = /node_modules/;

	const currentPath = path.join(basePath, modulePath);
	const exists = await file.exists(currentPath);
	if (exists) {
		return currentPath;
	}
	if (!isNodeModule.test(modulePath)) {
		winston.warn('[plugins] File not found: ' + currentPath + ' (Ignoring)');
		return;
	}

	const dirPath = path.dirname(basePath);
	if (dirPath === basePath) {
		winston.warn('[plugins] File not found: ' + currentPath + ' (Ignoring)');
		return;
	}

	return await resolveModulePath(dirPath, modulePath);
}


Data.getScripts = async function getScripts(pluginData, target) {
	target = (target === 'client') ? 'scripts' : 'acpScripts';

	const input = pluginData[target];
	if (!Array.isArray(input) || !input.length) {
		return;
	}

	const scripts = [];

	for (const filePath of input) {
		/* eslint-disable no-await-in-loop */
		const modulePath = await resolveModulePath(pluginData.path, filePath);
		if (modulePath) {
			scripts.push(modulePath);
		}
	}
	if (scripts.length) {
		winston.verbose('[plugins] Found ' + scripts.length + ' js file(s) for plugin ' + pluginData.id);
	}
	return scripts;
};


Data.getModules = async function getModules(pluginData) {
	if (!pluginData.modules || !pluginData.hasOwnProperty('modules')) {
		return;
	}

	let pluginModules = pluginData.modules;

	if (Array.isArray(pluginModules)) {
		var strip = parseInt(pluginData.modulesStrip, 10) || 0;

		pluginModules = pluginModules.reduce(function (prev, modulePath) {
			var key;
			if (strip) {
				key = modulePath.replace(new RegExp('.?(/[^/]+){' + strip + '}/'), '');
			} else {
				key = path.basename(modulePath);
			}

			prev[key] = modulePath;
			return prev;
		}, {});
	}

	const modules = {};
	async function processModule(key) {
		const modulePath = await resolveModulePath(pluginData.path, pluginModules[key]);
		if (modulePath) {
			modules[key] = path.relative(basePath, modulePath);
		}
	}

	await Promise.all(Object.keys(pluginModules).map(key => processModule(key)));

	const len = Object.keys(modules).length;
	winston.verbose('[plugins] Found ' + len + ' AMD-style module(s) for plugin ' + pluginData.id);
	return modules;
};

Data.getSoundpack = async function getSoundpack(pluginData) {
	var spack = pluginData.soundpack;
	if (!spack || !spack.dir || !spack.sounds) {
		return;
	}

	var soundpack = {};
	soundpack.name = spack.name || pluginData.name;
	soundpack.id = pluginData.id;
	soundpack.dir = path.join(pluginData.path, spack.dir);
	soundpack.sounds = {};

	async function processSoundPack(name) {
		const soundFile = spack.sounds[name];
		const exists = await file.exists(path.join(soundpack.dir, soundFile));
		if (!exists) {
			winston.warn('[plugins] Sound file not found: ' + soundFile);
			return;
		}
		soundpack.sounds[name] = soundFile;
	}

	await Promise.all(Object.keys(spack.sounds).map(key => processSoundPack(key)));

	const len = Object.keys(soundpack.sounds).length;
	winston.verbose('[plugins] Found ' + len + ' sound file(s) for plugin ' + pluginData.id);
	return soundpack;
};

Data.getLanguageData = async function getLanguageData(pluginData) {
	if (typeof pluginData.languages !== 'string') {
		return;
	}

	const pathToFolder = path.join(__dirname, '../../node_modules/', pluginData.id, pluginData.languages);
	const paths = await file.walk(pathToFolder);

	const namespaces = [];
	const languages = [];

	paths.forEach(function (p) {
		const rel = path.relative(pathToFolder, p).split(/[/\\]/);
		const language = rel.shift().replace('_', '-').replace('@', '-x-');
		const namespace = rel.join('/').replace(/\.json$/, '');

		if (!language || !namespace) {
			return;
		}

		languages.push(language);
		namespaces.push(namespace);
	});

	return {
		languages: languages,
		namespaces: namespaces,
	};
};
