'use strict';

const nconf = require('nconf');

const plugins = require('../../plugins');
const db = require('../../database');
const { pluginNamePattern } = require('../../constants');

const Plugins = module.exports;

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
