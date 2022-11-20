'use strict';

import meta from '../../meta';
const plugins = require('../../plugins');
const logger = require('../../logger');
const events = require('../../events');
const index = require('../index');

const Config  = {} as any;

Config.set = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	const _data  = {} as any;
	_data[data.key] = data.value;
	await Config.setMultiple(socket, _data);
};

Config.setMultiple = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	const changes  = {} as any;
	const newData = meta.configs.serialize(data);
	const oldData = meta.configs.serialize(meta.config);
	Object.keys(newData).forEach((key) => {
		if (newData[key] !== oldData[key]) {
			changes[key] = newData[key];
			changes[`${key}_old`] = meta.config[key];
		}
	});
	await meta.configs.setMultiple(data);
	for (const [key, value] of Object.entries(data)) {
		const setting = { key, value };
		plugins.hooks.fire('action:config.set', setting);
		logger.monitorConfig({ io: index.server }, setting);
	}
	if (Object.keys(changes).length) {
		changes.type = 'config-change';
		changes.uid = socket.uid;
		changes.ip = socket.ip;
		await events.log(changes);
	}
};

Config.remove = async function (socket, key) {
	await meta.configs.remove(key);
};
