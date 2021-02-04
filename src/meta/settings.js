'use strict';

const db = require('../database');
const plugins = require('../plugins');
const Meta = require('./index');
const pubsub = require('../pubsub');
const cache = require('../cache');

const Settings = module.exports;

Settings.get = async function (hash) {
	const cached = cache.get(`settings:${hash}`);
	if (cached) {
		return cached;
	}
	let data = await db.getObject(`settings:${hash}`) || {};
	const sortedLists = await db.getSetMembers(`settings:${hash}:sorted-lists`);

	await Promise.all(sortedLists.map(async function (list) {
		const members = await db.getSortedSetRange(`settings:${hash}:sorted-list:${list}`, 0, -1) || [];
		const keys = [];

		data[list] = [];
		for (const order of members) {
			keys.push(`settings:${hash}:sorted-list:${list}:${order}`);
		}

		const objects = await db.getObjects(keys);
		objects.forEach(function (obj) {
			data[list].push(obj);
		});
	}));

	({ values: data } = await plugins.hooks.fire('filter:settings.get', { plugin: hash, values: data }));
	cache.set(`settings:${hash}`, data);
	return data;
};

Settings.getOne = async function (hash, field) {
	const data = await Settings.get(hash);
	return data[field] !== undefined ? data[field] : null;
};

Settings.set = async function (hash, values, quiet) {
	quiet = quiet || false;

	({ plugin: hash, settings: values, quiet } = await plugins.hooks.fire('filter:settings.set', { plugin: hash, settings: values, quiet }));

	const sortedListData = {};
	for (const key in values) {
		if (values.hasOwnProperty(key)) {
			if (Array.isArray(values[key]) && typeof values[key][0] !== 'string') {
				sortedListData[key] = values[key];
				delete values[key];
			}
		}
	}
	const sortedLists = Object.keys(sortedListData);

	if (sortedLists.length) {
		// Remove provided (but empty) sorted lists from the hash set
		await db.setRemove(`settings:${hash}:sorted-lists`, sortedLists.filter(list => !sortedListData[list].length));
		await db.setAdd(`settings:${hash}:sorted-lists`, sortedLists);

		await Promise.all(sortedLists.map(async function (list) {
			const numItems = await db.sortedSetCard(`settings:${hash}:sorted-list:${list}`);
			const deleteKeys = [`settings:${hash}:sorted-list:${list}`];
			for (let x = 0; x < numItems; x++) {
				deleteKeys.push(`settings:${hash}:sorted-list:${list}:${x}`);
			}
			await db.deleteAll(deleteKeys);
		}));

		const ops = [];
		sortedLists.forEach(function (list) {
			const arr = sortedListData[list];
			arr.forEach(function (data, order) {
				ops.push(db.sortedSetAdd(`settings:${hash}:sorted-list:${list}`, order, order));
				ops.push(db.setObject(`settings:${hash}:sorted-list:${list}:${order}`, data));
			});
		});

		await Promise.all(ops);
	}

	if (Object.keys(values).length) {
		await db.setObject(`settings:${hash}`, values);
	}

	cache.del(`settings:${hash}`);

	plugins.hooks.fire('action:settings.set', {
		plugin: hash,
		settings: { ...values, ...sortedListData },	// Add back sorted list data to values hash
	});

	pubsub.publish(`action:settings.set.${hash}`, values);
	Meta.reloadRequired = !quiet;
};

Settings.setOne = async function (hash, field, value) {
	const data = {};
	data[field] = value;
	await Settings.set(hash, data);
};

Settings.setOnEmpty = async function (hash, values) {
	const settings = await Settings.get(hash) || {};
	const empty = {};

	Object.keys(values).forEach(function (key) {
		if (!settings.hasOwnProperty(key)) {
			empty[key] = values[key];
		}
	});


	if (Object.keys(empty).length) {
		await Settings.set(hash, empty);
	}
};
