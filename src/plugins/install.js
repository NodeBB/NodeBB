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
const cache = require('../cache');

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
		pubsub.on('plugins:toggleInstall', async (data) => {
			if (data.hostname !== os.hostname()) {
				try {
					await toggleInstall(data.id, data.version, data.type);
				} catch (err) {
					winston.error(err.stack);
				}
			}
		});

		pubsub.on('plugins:upgrade', async (data) => {
			if (data.hostname !== os.hostname()) {
				try {
					await upgrade(data.id, data.version);
				} catch (err) {
					winston.error(err.stack);
				}
			}
		});
	}

	Plugins.toggleActive = async function (id, active) {
		if (nconf.get('plugins:active')) {
			winston.error('Cannot activate plugins while plugin state is set in the configuration (config.json, environmental variables or terminal arguments), please modify the configuration instead');
			throw new Error('[[error:plugins-set-in-configuration]]');
		}
		if (!pluginNamePattern.test(id)) {
			throw new Error('[[error:invalid-plugin-id]]');
		}
		if (typeof active === 'string') {
			active = active === '1';
		}
		const isActivating = active ?? !await Plugins.isActive(id);
		if (!isActivating) {
			await db.sortedSetRemove('plugins:active', id);
		} else {
			const count = await db.sortedSetCard('plugins:active');
			await db.sortedSetAdd('plugins:active', count, id);
		}
		cache.set(`plugin:isActive:${id}`, isActivating);
		meta.reloadRequired = true;
		const hook = isActivating ? 'activate' : 'deactivate';
		Plugins.hooks.fire(`action:plugin.${hook}`, { id: id });
		return { id: id, active: isActivating };
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

	Plugins.toggleInstall = async function (id, version, type) {
		if (!pluginNamePattern.test(id)) {
			throw new Error('[[error:invalid-plugin-id]]');
		}
		pubsub.publish('plugins:toggleInstall', { hostname: os.hostname(), id, version, type });
		return await toggleInstall(id, version, type);
	};

	const runPackageManagerCommandAsync = util.promisify(runPackageManagerCommand);

	async function toggleInstall(id, version, type) {
		const [installed, active] = await Promise.all([
			Plugins.isInstalled(id),
			Plugins.isActive(id),
		]);
		if (type && type !== 'install' && type !== 'uninstall') {
			throw new Error('[[error:invalid-data]]');
		}
		type = type ?? (installed ? 'uninstall' : 'install');
		if (active && !nconf.get('plugins:active')) {
			await Plugins.toggleActive(id);
		}

		await runPackageManagerCommandAsync(type, id, version || 'latest');
		const pluginData = await Plugins.get(id);
		Plugins.hooks.fire(`action:plugin.${type}`, { id, version });
		return pluginData;
	}

	function runPackageManagerCommand(command, pkgName, version, callback) {
		if (!pluginNamePattern.test(pkgName)) {
			throw new Error('[[error:invalid-plugin-id]]');
		}
		const args = [
			packageManagerCommands[packageManager][command],
			pkgName + (command === 'install' && version ? `@${version}` : ''),
			'--save',
			'--ignore-scripts',
		];

		if (process.platform === 'win32') {
			const child = cproc.spawn(packageManagerExecutable, args, { shell: true });
			let stdout = '';
			let stderr = '';

			child.stdout.on('data', (data) => {
				stdout += data;
			});
			child.stderr.on('data', (data) => {
				stderr += data;
			});

			child.on('close', (code) => {
				if (code !== 0) {
					const err = new Error(stderr || `Process exited with code ${code}`);
					return callback(err);
				}
				winston.verbose(`[plugins/${command}] ${stdout}`);
				callback();
			});
			child.on('error', callback);
		} else {
			cproc.execFile(packageManagerExecutable, args, (err, stdout) => {
				if (err) {
					return callback(err);
				}

				winston.verbose(`[plugins/${command}] ${stdout}`);
				callback();
			});
		}
	}


	Plugins.upgrade = async function (id, version) {
		if (!pluginNamePattern.test(id)) {
			throw new Error('[[error:invalid-plugin-id]]');
		}
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

	Plugins.isSystemPlugin = async function (id) {
		const pluginDir = path.join(paths.nodeModules, id, 'plugin.json');
		try {
			const pluginData = JSON.parse(await fs.readFile(pluginDir, 'utf8'));
			return pluginData && pluginData.system === true;
		} catch (err) {
			return false;
		}
	};

	Plugins.isActive = async function (id) {
		if (nconf.get('plugins:active')) {
			return nconf.get('plugins:active').includes(id);
		}
		const cached = cache.get(`plugin:isActive:${id}`);
		if (cached !== undefined) {
			return cached;
		}
		const isActive = await db.isSortedSetMember('plugins:active', id);
		cache.set(`plugin:isActive:${id}`, isActive);
		return isActive;
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
