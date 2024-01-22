'use strict';

const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;
const nconf = require('nconf');
const os = require('os');
const cproc = require('child_process');
const util = require('util');

const request = require('../request');
const db = require('../database');
const meta = require('../meta');
const pubsub = require('../pubsub');
const { paths, pluginNamePattern } = require('../constants');
const pkgInstall = require('../cli/package-install');

const packageManager = pkgInstall.getPackageManager();
let packageManagerExecutable = packageManager;
const packageManagerCommands = {
	yarn: {
		install: 'add',
		uninstall: 'remove',
	},
	npm: {
		install: 'install',
		uninstall: 'uninstall',
	},
	cnpm: {
		install: 'install',
		uninstall: 'uninstall',
	},
	pnpm: {
		install: 'install',
		uninstall: 'uninstall',
	},
};

if (process.platform === 'win32') {
	packageManagerExecutable += '.cmd';
}

module.exports = function (Plugins) {
	if (nconf.get('isPrimary')) {
		pubsub.on('plugins:toggleInstall', (data) => {
			if (data.hostname !== os.hostname()) {
				toggleInstall(data.id, data.version);
			}
		});

		pubsub.on('plugins:upgrade', (data) => {
			if (data.hostname !== os.hostname()) {
				upgrade(data.id, data.version);
			}
		});
	}

	Plugins.toggleActive = async function (id) {
		if (nconf.get('plugins:active')) {
			winston.error('Cannot activate plugins while plugin state is set in the configuration (config.json, environmental variables or terminal arguments), please modify the configuration instead');
			throw new Error('[[error:plugins-set-in-configuration]]');
		}
		if (!pluginNamePattern.test(id)) {
			throw new Error('[[error:invalid-plugin-id]]');
		}
		const isActive = await Plugins.isActive(id);
		if (isActive) {
			await db.sortedSetRemove('plugins:active', id);
		} else {
			const count = await db.sortedSetCard('plugins:active');
			await db.sortedSetAdd('plugins:active', count, id);
		}
		meta.reloadRequired = true;
		const hook = isActive ? 'deactivate' : 'activate';
		Plugins.hooks.fire(`action:plugin.${hook}`, { id: id });
		return { id: id, active: !isActive };
	};

	Plugins.checkWhitelist = async function (id, version) {
		const { response, body } = await request.get(`https://packages.nodebb.org/api/v1/plugins/${encodeURIComponent(id)}`);
		if (!response.ok) {
			throw new Error(`[[error:cant-connect-to-nbbpm]]`);
		}
		if (body && body.code === 'ok' && (version === 'latest' || body.payload.valid.includes(version))) {
			return;
		}

		throw new Error('[[error:plugin-not-whitelisted]]');
	};

	Plugins.suggest = async function (pluginId, nbbVersion) {
		const { response, body } = await request.get(`https://packages.nodebb.org/api/v1/suggest?package=${encodeURIComponent(pluginId)}&version=${encodeURIComponent(nbbVersion)}`);
		if (!response.ok) {
			throw new Error(`[[error:cant-connect-to-nbbpm]]`);
		}
		return body;
	};

	Plugins.toggleInstall = async function (id, version) {
		pubsub.publish('plugins:toggleInstall', { hostname: os.hostname(), id: id, version: version });
		return await toggleInstall(id, version);
	};

	const runPackageManagerCommandAsync = util.promisify(runPackageManagerCommand);

	async function toggleInstall(id, version) {
		const [installed, active] = await Promise.all([
			Plugins.isInstalled(id),
			Plugins.isActive(id),
		]);
		const type = installed ? 'uninstall' : 'install';
		if (active && !nconf.get('plugins:active')) {
			await Plugins.toggleActive(id);
		}
		await runPackageManagerCommandAsync(type, id, version || 'latest');
		const pluginData = await Plugins.get(id);
		Plugins.hooks.fire(`action:plugin.${type}`, { id: id, version: version });
		return pluginData;
	}

	function runPackageManagerCommand(command, pkgName, version, callback) {
		cproc.execFile(packageManagerExecutable, [
			packageManagerCommands[packageManager][command],
			pkgName + (command === 'install' && version ? `@${version}` : ''),
			'--save',
		], (err, stdout) => {
			if (err) {
				return callback(err);
			}

			winston.verbose(`[plugins/${command}] ${stdout}`);
			callback();
		});
	}


	Plugins.upgrade = async function (id, version) {
		pubsub.publish('plugins:upgrade', { hostname: os.hostname(), id: id, version: version });
		return await upgrade(id, version);
	};

	async function upgrade(id, version) {
		await runPackageManagerCommandAsync('install', id, version || 'latest');
		const isActive = await Plugins.isActive(id);
		meta.reloadRequired = isActive;
		return isActive;
	}

	Plugins.isInstalled = async function (id) {
		const pluginDir = path.join(paths.nodeModules, id);
		try {
			const stats = await fs.stat(pluginDir);
			return stats.isDirectory();
		} catch (err) {
			return false;
		}
	};

	Plugins.isActive = async function (id) {
		if (nconf.get('plugins:active')) {
			return nconf.get('plugins:active').includes(id);
		}
		return await db.isSortedSetMember('plugins:active', id);
	};

	Plugins.getActive = async function () {
		if (nconf.get('plugins:active')) {
			return nconf.get('plugins:active');
		}
		return await db.getSortedSetRange('plugins:active', 0, -1);
	};

	Plugins.autocomplete = async (fragment) => {
		const pluginDir = paths.nodeModules;
		const plugins = (await fs.readdir(pluginDir)).filter(filename => filename.startsWith(fragment));

		// Autocomplete only if single match
		return plugins.length === 1 ? plugins.pop() : fragment;
	};
};
