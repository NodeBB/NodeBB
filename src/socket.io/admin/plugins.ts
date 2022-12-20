'use strict';

import nconf from 'nconf';
import plugins from '../../plugins';
import events from '../../events';
import db from '../../database';

const Plugins  = {} as any;

Plugins.toggleActive = async function (socket, plugin_id) {
	require('../../posts/cache').reset();
	const data = await plugins.toggleActive(plugin_id);
	await events.log({
		type: `plugin-${data.active ? 'activate' : 'deactivate'}`,
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
	await Promise.all(data.map(plugin => db.sortedSetAdd('plugins:active', plugin.order || 0, plugin.name)));
};

Plugins.upgrade = async function (socket, data) {
	return await plugins.upgrade(data.id, data.version);
};

export default Plugins;