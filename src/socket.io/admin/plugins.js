'use strict';

const nconf = require('nconf');

const plugins = require('../../plugins');
const events = require('../../events');
const db = require('../../database');
const postsCache = require('../../posts/cache');
const { pluginNamePattern } = require('../../constants');

const Plugins = module.exports;

Plugins.toggleActive = async function (socket, plugin_id) {
	postsCache.reset();
	const data = await plugins.toggleActive(plugin_id);
	await events.log({
		type: `plugin-${data.active ? 'activate' : 'deactivate'}`,
		text: plugin_id,
		uid: socket.uid,
	});
	return data;
};

Plugins.toggleInstall = async function (socket, data) {
	postsCache.reset();
	await plugins.checkWhitelist(data.id, data.version);
	const pluginData = await plugins.toggleInstall(data.id, data.version);
	await events.log({
		type: `plugin-${pluginData.installed ? 'install' : 'uninstall'}`,
		text: data.id,
		version: data.version,
		uid: socket.uid,
	});
	return pluginData;
};

Plugins.getActive = async function () {
	return await plugins.getActive();
};

Plugins.orderActivePlugins = async function (socket, data) {
	if (nconf.get('plugins:active')) {
		throw new Error('[[error:plugins-set-in-configuration]]');
	}
	data = data.filter(plugin => plugin && plugin.name);

	data.forEach((plugin) => {
		if (!pluginNamePattern.test(plugin.name)) {
			throw new Error('[[error:invalid-plugin-id]]');
		}
	});

	await db.sortedSetAdd('plugins:active', data.map(p => p.order || 0), data.map(p => p.name));
};

Plugins.upgrade = async function (socket, data) {
	return await plugins.upgrade(data.id, data.version);
};
