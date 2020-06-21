'use strict';

const nconf = require('nconf');
const winston = require('winston');
const plugins = require('../../plugins');
const meta = require('../../meta');

const pluginsController = module.exports;

pluginsController.get = async function (req, res) {
	const [compatible, all] = await Promise.all([
		getCompatiblePluigns(),
		getAllPlugins(),
	]);

	const compatiblePkgNames = compatible.map(pkgData => pkgData.name);
	const installedPlugins = compatible.filter(plugin => plugin && plugin.installed);
	const activePlugins = all.filter(plugin => plugin && plugin.installed && plugin.active);

	res.render('admin/extend/plugins', {
		installed: installedPlugins,
		installedCount: installedPlugins.length,
		activeCount: activePlugins.length,
		inactiveCount: Math.max(0, installedPlugins.length - activePlugins.length),
		upgradeCount: compatible.reduce(function (count, current) {
			if (current.installed && current.outdated) {
				count += 1;
			}
			return count;
		}, 0),
		download: compatible.filter(function (plugin) {
			return !plugin.installed;
		}),
		incompatible: all.filter(function (plugin) {
			return !compatiblePkgNames.includes(plugin.name);
		}),
		submitPluginUsage: meta.config.submitPluginUsage,
		version: nconf.get('version'),
	});
};

async function getCompatiblePluigns() {
	return await getPlugins(true);
}

async function getAllPlugins() {
	return await getPlugins(false);
}

async function getPlugins(matching) {
	try {
		const pluginsData = await plugins.list(matching);
		return pluginsData || [];
	} catch (err) {
		winston.error(err.stack);
		return [];
	}
}
