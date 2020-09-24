'use strict';

const plugins = require('../../plugins');
const events = require('../../events');
const db = require('../../database');

const Plugins = module.exports;

Plugins.toggleActive = async function (socket, plugin_id) {
	require('../../posts/cache').reset();
	const data = await plugins.toggleActive(plugin_id);
	await events.log({
		type: 'plugin-' + (data.active ? 'activate' : 'deactivate'),
		text: plugin_id,
		uid: socket.uid,
	});
	return data;
};

Plugins.toggleInstall = async function (socket, data) {
	require('../../posts/cache').reset();
	await plugins.checkWhitelist(data.id, data.version);
	const pluginData = await plugins.toggleInstall(data.id, data.version);
	await events.log({
		type: 'plugin-' + (pluginData.installed ? 'install' : 'uninstall'),
		text: data.id,
		version: data.version,
		uid: socket.uid,
	});
	return pluginData;
};

Plugins.getActive = function (socket, data, callback) {
	plugins.getActive(callback);
};

Plugins.orderActivePlugins = async function (socket, data) {
	data = data.filter(plugin => plugin && plugin.name);
	await Promise.all(data.map(plugin => db.sortedSetAdd('plugins:active', plugin.order || 0, plugin.name)));
};

Plugins.upgrade = function (socket, data, callback) {
	plugins.upgrade(data.id, data.version, callback);
};
