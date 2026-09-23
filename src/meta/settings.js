'use strict';

const _ = require('lodash');

const db = require('../database');
const plugins = require('../plugins');
const Meta = require('./index');
const pubsub = require('../pubsub');
const cache = require('../cache');

const Settings = module.exports;

Settings.get = async function (hash) {
	const cached = await cache.get(`settings:${hash}`, async () => {
		const data = await db.getObject(`settings:${hash}`);
		const values = data || {};

		const result = await plugins.hooks.fire('filter:settings.get', { plugin: hash, values: values });
		return result.values;
	});
	return _.cloneDeep(cached);
};

Settings.getOne = async function (hash, field) {
	const data = await Settings.get(hash);
	return data[field] !== undefined ? data[field] : null;
};

Settings.set = async function (hash, values, quiet, clear) {
	quiet = quiet || false;

	({ plugin: hash, settings: values, quiet } = await plugins.hooks.fire('filter:settings.set', { plugin: hash, settings: values, quiet }));

	// A full-form save replaces the hash, so drop stale fields not present in `values`
	if (clear) {
		await db.delete(`settings:${hash}`);
	}

	if (Object.keys(values).length) {
		await db.setObject(`settings:${hash}`, values);
	}

	cache.del(`settings:${hash}`);

	plugins.hooks.fire('action:settings.set', {
		plugin: hash,
		settings: values,
		quiet,
	});

	pubsub.publish(`action:settings.set.${hash}`, values);
	if (!Meta.reloadRequired && !quiet) {
		Meta.reloadRequired = true;
	}
};

Settings.setOne = async function (hash, field, value) {
	const data = {};
	data[field] = value;
	await Settings.set(hash, data);
};

Settings.setOnEmpty = async function (hash, values) {
	const settings = await Settings.get(hash) || {};
	const empty = {};

	Object.keys(values).forEach((key) => {
		if (!settings.hasOwnProperty(key)) {
			empty[key] = values[key];
		}
	});


	if (Object.keys(empty).length) {
		await Settings.set(hash, empty);
	}
};
