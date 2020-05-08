'use strict';

const meta = require('../../meta');
const events = require('../../events');
const Settings = module.exports;

Settings.get = function (socket, data, callback) {
	meta.settings.get(data.hash, callback);
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

Settings.clearSitemapCache = function (socket, data, callback) {
	require('../../sitemap').clearCache();
	callback();
};
