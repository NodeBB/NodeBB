'use strict';

import nconf from 'nconf';
import winston from 'winston';
const plugins = require('../../plugins');
import meta from '../../meta';

const pluginsController  = {} as any;

pluginsController.get = async function (req, res) {
	const [compatible, all, trending] = await Promise.all([
		getCompatiblePlugins(),
		getAllPlugins(),
		plugins.listTrending(),
	]);

	const compatiblePkgNames = compatible.map((pkgData) => pkgData.name);
	const installedPlugins = compatible.filter((plugin) => plugin && plugin.installed);
	const activePlugins = all.filter((plugin) => plugin && plugin.installed && plugin.active);

	const trendingScores = trending.reduce((memo, cur) => {
		memo[cur.label] = cur.value;
		return memo;
	}, {});
	const trendingPlugins = all
		.filter((plugin) => plugin && Object.keys(trendingScores).includes(plugin.id))
		.sort((a, b) => trendingScores[b.id] - trendingScores[a.id])
		.map((plugin) => {
			plugin.downloads = trendingScores[plugin.id];
			return plugin;
		});

	res.render('admin/extend/plugins', {
		installed: installedPlugins,
		installedCount: installedPlugins.length,
		activeCount: activePlugins.length,
		inactiveCount: Math.max(0, installedPlugins.length - activePlugins.length),
		canChangeState: !nconf.get('plugins:active'),
		upgradeCount: compatible.reduce((count: number, current) => {
			if (current.installed && current.outdated) {
				count += 1;
			}
			return count;
		}, 0),
		download: compatible.filter((plugin) => !plugin.installed),
		incompatible: all.filter((plugin) => !compatiblePkgNames.includes(plugin.name)),
		trending: trendingPlugins,
		submitPluginUsage: meta.configs.submitPluginUsage,
		version: nconf.get('version'),
	});
};

async function getCompatiblePlugins() {
	return await getPlugins(true);
}

async function getAllPlugins() {
	return await getPlugins(false);
}

async function getPlugins(matching) {
	try {
		const pluginsData = await plugins.list(matching);
		return pluginsData || [];
	} catch (err: any) {
		winston.error(err.stack);
		return [];
	}
}

export default pluginsController;