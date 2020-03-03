'use strict';

const meta = require('../../meta');
const plugins = require('../../plugins');
const logger = require('../../logger');
const events = require('../../events');
const index = require('../index');

const Config = module.exports;

Config.set = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	const _data = {};
	_data[data.key] = data.value;
	await Config.setMultiple(socket, _data);
};

Config.setMultiple = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	const changes = {};
	const newData = meta.configs.serialize(data);
	const oldData = meta.configs.serialize(meta.config);
	Object.keys(newData).forEach(function (key) {
		if (newData[key] !== oldData[key]) {
			changes[key] = newData[key];
			changes[key + '_old'] = meta.config[key];
		}
	});
	await meta.configs.setMultiple(data);
	for (const field in data) {
		if (data.hasOwnProperty(field)) {
			const setting = {
				key: field,
				value: data[field],
			};
			plugins.fireHook('action:config.set', setting);
			logger.monitorConfig({ io: index.server }, setting);
		}
	}
	if (Object.keys(changes).length) {
		changes.type = 'config-change';
		changes.uid = socket.uid;
		changes.ip = socket.ip;
		await events.log(changes);
	}
};

Config.remove = function (socket, key, callback) {
	meta.configs.remove(key, callback);
};
