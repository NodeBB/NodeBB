'use strict';

import meta from '../../meta';
import events from '../../events';

const Settings  = {} as any;

Settings.get = async function (socket, data) {
	return await meta.settings.get(data.hash);
};

Settings.set = async function (socket, data) {
	await meta.settings.set(data.hash, data.values);
	const eventData = data.values;
	eventData.type = 'settings-change';
	eventData.uid = socket.uid;
	eventData.ip = socket.ip;
	eventData.hash = data.hash;
	await events.log(eventData);
};

Settings.clearSitemapCache = async function () {
	require('../../sitemap').clearCache();
};

export default Settings;