'use strict';

const winston = require('winston');
const path = require('path');
const fs = require('fs');
const nconf = require('nconf');
const os = require('os');
const cproc = require('child_process');
const util = require('util');

const db = require('../database');
const meta = require('../meta');
const pubsub = require('../pubsub');

const statAsync = util.promisify(fs.stat);

const supportedPackageManagerList = require('../cli/package-install').supportedPackageManager; // load config from src/cli/package-install.js
const packageManager = supportedPackageManagerList.indexOf(nconf.get('package_manager')) >= 0 ? nconf.get('package_manager') : 'npm';
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
	if (nconf.get('isPrimary') === 'true') {
		pubsub.on('plugins:toggleInstall', function (data) {
			if (data.hostname !== os.hostname()) {
				toggleInstall(data.id, data.version);
			}
		});

		pubsub.on('plugins:upgrade', function (data) {
			if (data.hostname !== os.hostname()) {
				upgrade(data.id, data.version);
			}
		});
	}

	Plugins.toggleActive = async function (id) {
		const isActive = await Plugins.isActive(id);
		if (isActive) {
			await db.sortedSetRemove('plugins:active', id);
		} else {
			const count = await db.sortedSetCard('plugins:active');
			await db.sortedSetAdd('plugins:active', count, id);
		}
		meta.reloadRequired = true;
		Plugins.fireHook(isActive ? 'action:plugin.deactivate' : 'action:plugin.activate', { id: id });
		return { id: id, active: !isActive };
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
		if (active) {
			await Plugins.toggleActive(id);
		}
		await runPackageManagerCommandAsync(type, id, version || 'latest');
		const pluginData = await Plugins.get(id);
		Plugins.fireHook('action:plugin.' + type, { id: id, version: version });
		return pluginData;
	}

	function runPackageManagerCommand(command, pkgName, version, callback) {
		cproc.execFile(packageManagerExecutable, [
			packageManagerCommands[packageManager][command],
			pkgName + (command === 'install' ? '@' + version : ''),
			'--save',
		], function (err, stdout) {
			if (err) {
				return callback(err);
			}

			winston.verbose('[plugins/' + command + '] ' + stdout);
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
		const pluginDir = path.join(__dirname, '../../node_modules', id);
		try {
			const stats = await statAsync(pluginDir);
			return stats.isDirectory();
		} catch (err) {
			return false;
		}
	};

	Plugins.isActive = async function (id) {
		return await db.isSortedSetMember('plugins:active', id);
	};

	Plugins.getActive = async function () {
		return await db.getSortedSetRange('plugins:active', 0, -1);
	};
};
