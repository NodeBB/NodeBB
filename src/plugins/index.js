'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const semver = require('semver');
const nconf = require('nconf');
const chalk = require('chalk');

const request = require('../request');
const user = require('../user');
const posts = require('../posts');

const { pluginNamePattern, themeNamePattern, paths } = require('../constants');

let app;
let middleware;

const Plugins = module.exports;

require('./install')(Plugins);
require('./load')(Plugins);
require('./usage')(Plugins);
Plugins.data = require('./data');
Plugins.hooks = require('./hooks');

Plugins.getPluginPaths = Plugins.data.getPluginPaths;
Plugins.loadPluginInfo = Plugins.data.loadPluginInfo;

Plugins.pluginsData = {};
Plugins.libraries = {};
Plugins.loadedHooks = {};
Plugins.staticDirs = {};
Plugins.cssFiles = [];
Plugins.scssFiles = [];
Plugins.acpScssFiles = [];
Plugins.clientScripts = [];
Plugins.acpScripts = [];
Plugins.libraryPaths = [];
Plugins.versionWarning = [];
Plugins.languageData = {};
Plugins.loadedPlugins = [];

Plugins.initialized = false;

Plugins.requireLibrary = function (pluginData) {
	let libraryPath;
	// attempt to load a plugin directly with `require("nodebb-plugin-*")`
	// Plugins should define their entry point in the standard `main` property of `package.json`
	try {
		libraryPath = pluginData.path;
		Plugins.libraries[pluginData.id] = require(libraryPath);
	} catch (e) {
		// DEPRECATED: @1.15.0, remove in version >=1.17
		// for backwards compatibility
		// if that fails, fall back to `pluginData.library`
		if (pluginData.library) {
			winston.warn(`   [plugins/${pluginData.id}] The plugin.json field "library" is deprecated. Please use the package.json field "main" instead.`);
			winston.verbose(`[plugins/${pluginData.id}] See https://github.com/NodeBB/NodeBB/issues/8686`);

			libraryPath = path.join(pluginData.path, pluginData.library);
			Plugins.libraries[pluginData.id] = require(libraryPath);
		} else {
			throw e;
		}
	}

	Plugins.libraryPaths.push(libraryPath);
};

Plugins.init = async function (nbbApp, nbbMiddleware) {
	if (Plugins.initialized) {
		return;
	}

	if (nbbApp) {
		app = nbbApp;
		middleware = nbbMiddleware;
	}

	if (global.env === 'development') {
		winston.verbose('[plugins] Initializing plugins system');
	}

	await Plugins.reload();
	if (global.env === 'development') {
		winston.info('[plugins] Plugins OK');
	}

	Plugins.initialized = true;
};

Plugins.reload = async function () {
	// Resetting all local plugin data
	Plugins.libraries = {};
	Plugins.loadedHooks = {};
	Plugins.staticDirs = {};
	Plugins.versionWarning = [];
	Plugins.cssFiles.length = 0;
	Plugins.scssFiles.length = 0;
	Plugins.acpScssFiles.length = 0;
	Plugins.clientScripts.length = 0;
	Plugins.acpScripts.length = 0;
	Plugins.libraryPaths.length = 0;
	Plugins.loadedPlugins.length = 0;

	await user.addInterstitials();

	const paths = await Plugins.getPluginPaths();
	for (const path of paths) {
		/* eslint-disable no-await-in-loop */
		await Plugins.loadPlugin(path);
	}

	// If some plugins are incompatible, throw the warning here
	if (Plugins.versionWarning.length && nconf.get('isPrimary')) {
		console.log('');
		winston.warn('[plugins/load] The following plugins may not be compatible with your version of NodeBB. This may cause unintended behaviour or crashing. In the event of an unresponsive NodeBB caused by this plugin, run `./nodebb reset -p PLUGINNAME` to disable it.');
		for (let x = 0, numPlugins = Plugins.versionWarning.length; x < numPlugins; x += 1) {
			console.log(`${chalk.yellow('  * ') + Plugins.versionWarning[x]}`);
		}
		console.log('');
	}

	// Core hooks
	posts.registerHooks();

	// Deprecation notices
	Plugins.hooks._deprecated.forEach((deprecation, hook) => {
		if (!deprecation.affected || !deprecation.affected.size) {
			return;
		}

		const replacement = deprecation.hasOwnProperty('new') ? `Please use ${chalk.yellow(deprecation.new)} instead.` : 'There is no alternative.';
		winston.warn(`[plugins/load] ${chalk.white.bgRed.bold('DEPRECATION')} The hook ${chalk.yellow(hook)} has been deprecated as of ${deprecation.since}, and slated for removal in ${deprecation.until}. ${replacement} The following plugins are still listening for this hook:`);
		deprecation.affected.forEach(id => console.log(`  ${chalk.yellow('*')} ${id}`));
	});

	// Lower priority runs earlier
	Object.keys(Plugins.loadedHooks).forEach((hook) => {
		Plugins.loadedHooks[hook].sort((a, b) => a.priority - b.priority);
	});

	// Post-reload actions
	await posts.configureSanitize();
};

Plugins.reloadRoutes = async function (params) {
	const controllers = require('../controllers');
	await Plugins.hooks.fire('static:app.load', { app: app, router: params.router, middleware: middleware, controllers: controllers });
	winston.verbose('[plugins] All plugins reloaded and rerouted');
};

Plugins.get = async function (id) {
	const url = `${nconf.get('registry') || 'https://packages.nodebb.org'}/api/v1/plugins/${id}`;
	const { response, body } = await request.get(url);
	if (!response.ok) {
		throw new Error(`[[error:unable-to-load-plugin, ${id}]]`);
	}
	let normalised = await Plugins.normalise([body ? body.payload : {}]);
	normalised = normalised.filter(plugin => plugin.id === id);
	return normalised.length ? normalised[0] : undefined;
};

Plugins.list = async function (matching) {
	if (matching === undefined) {
		matching = true;
	}
	const { version } = require(paths.currentPackage);
	const url = `${nconf.get('registry') || 'https://packages.nodebb.org'}/api/v1/plugins${matching !== false ? `?version=${version}` : ''}`;
	try {
		const { response, body } = await request.get(url);
		if (!response.ok) {
			throw new Error(`[[error:unable-to-load-plugins-from-nbbpm]]`);
		}
		return await Plugins.normalise(body);
	} catch (err) {
		winston.error(`Error loading ${url}`, err);
		return await Plugins.normalise([]);
	}
};

Plugins.listTrending = async () => {
	const url = `${nconf.get('registry') || 'https://packages.nodebb.org'}/api/v1/analytics/top/week`;
	const { response, body } = await request.get(url);
	if (!response.ok) {
		throw new Error(`[[error:unable-to-load-trending-plugins]]`);
	}
	return body;
};

Plugins.normalise = async function (apiReturn) {
	const pluginMap = {};
	const { dependencies } = require(paths.currentPackage);
	apiReturn = Array.isArray(apiReturn) ? apiReturn : [];
	apiReturn.forEach((packageData) => {
		packageData.id = packageData.name;
		packageData.installed = false;
		packageData.active = false;
		packageData.url = packageData.url || (packageData.repository ? packageData.repository.url : '');
		pluginMap[packageData.name] = packageData;
	});

	let installedPlugins = await Plugins.showInstalled();
	installedPlugins = installedPlugins.filter(plugin => plugin && !plugin.system);

	installedPlugins.forEach((plugin) => {
		// If it errored out because a package.json or plugin.json couldn't be read, no need to do this stuff
		if (plugin.error) {
			pluginMap[plugin.id] = pluginMap[plugin.id] || {};
			pluginMap[plugin.id].installed = true;
			pluginMap[plugin.id].error = true;
			return;
		}

		pluginMap[plugin.id] = pluginMap[plugin.id] || {};
		pluginMap[plugin.id].id = pluginMap[plugin.id].id || plugin.id;
		pluginMap[plugin.id].name = plugin.name || pluginMap[plugin.id].name;
		pluginMap[plugin.id].description = plugin.description;
		pluginMap[plugin.id].url = pluginMap[plugin.id].url || plugin.url;
		pluginMap[plugin.id].installed = true;
		pluginMap[plugin.id].isTheme = themeNamePattern.test(plugin.id);
		pluginMap[plugin.id].error = plugin.error || false;
		pluginMap[plugin.id].active = plugin.active;
		pluginMap[plugin.id].version = plugin.version;
		pluginMap[plugin.id].settingsRoute = plugin.settingsRoute;
		pluginMap[plugin.id].license = plugin.license;

		// If package.json defines a version to use, stick to that
		if (dependencies.hasOwnProperty(plugin.id) && semver.valid(dependencies[plugin.id])) {
			pluginMap[plugin.id].latest = dependencies[plugin.id];
		} else {
			pluginMap[plugin.id].latest = pluginMap[plugin.id].latest || plugin.version;
		}
		pluginMap[plugin.id].outdated = semver.gt(pluginMap[plugin.id].latest, pluginMap[plugin.id].version);
	});

	if (nconf.get('plugins:active')) {
		nconf.get('plugins:active').forEach((id) => {
			pluginMap[id] = pluginMap[id] || {};
			pluginMap[id].active = true;
		});
	}

	const pluginArray = Object.values(pluginMap);

	pluginArray.sort((a, b) => {
		if (a.name > b.name) {
			return 1;
		} else if (a.name < b.name) {
			return -1;
		}
		return 0;
	});

	return pluginArray;
};

Plugins.nodeModulesPath = paths.nodeModules;

Plugins.showInstalled = async function () {
	const dirs = await fs.promises.readdir(Plugins.nodeModulesPath);

	let pluginPaths = await findNodeBBModules(dirs);
	pluginPaths = pluginPaths.map(dir => path.join(Plugins.nodeModulesPath, dir));

	async function load(file) {
		try {
			const pluginData = await Plugins.loadPluginInfo(file);
			const isActive = await Plugins.isActive(pluginData.name);
			delete pluginData.hooks;
			delete pluginData.library;
			pluginData.active = isActive;
			pluginData.installed = true;
			pluginData.error = false;
			return pluginData;
		} catch (err) {
			winston.error(err.stack);
		}
	}
	const plugins = await Promise.all(pluginPaths.map(file => load(file)));
	return plugins.filter(Boolean);
};

async function findNodeBBModules(dirs) {
	const pluginPaths = [];
	await Promise.all(dirs.map(async (dirname) => {
		const dirPath = path.join(Plugins.nodeModulesPath, dirname);
		const isDir = await isDirectory(dirPath);
		if (!isDir) {
			return;
		}
		if (pluginNamePattern.test(dirname)) {
			pluginPaths.push(dirname);
			return;
		}

		if (dirname[0] === '@') {
			const subdirs = await fs.promises.readdir(dirPath);
			await Promise.all(subdirs.map(async (subdir) => {
				if (!pluginNamePattern.test(subdir)) {
					return;
				}

				const subdirPath = path.join(dirPath, subdir);
				const isDir = await isDirectory(subdirPath);
				if (isDir) {
					pluginPaths.push(`${dirname}/${subdir}`);
				}
			}));
		}
	}));
	return pluginPaths;
}

async function isDirectory(dirPath) {
	try {
		const stats = await fs.promises.stat(dirPath);
		return stats.isDirectory();
	} catch (err) {
		if (err.code !== 'ENOENT') {
			throw err;
		}
		return false;
	}
}

require('../promisify')(Plugins);
