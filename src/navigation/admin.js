'use strict';

const _ = require('lodash');

const plugins = require('../plugins');
const db = require('../database');
const translator = require('../translator');
const pubsub = require('../pubsub');

const admin = module.exports;
let cache = null;

pubsub.on('admin:navigation:save', function () {
	cache = null;
});

admin.save = async function (data) {
	const order = Object.keys(data);
	const items = data.map(function (item, index) {
		for (var i in item) {
			if (item.hasOwnProperty(i) && typeof item[i] === 'string' && (i === 'title' || i === 'text')) {
				item[i] = translator.escape(item[i]);
			}
		}
		item.order = order[index];
		return JSON.stringify(item);
	});

	cache = null;
	pubsub.publish('admin:navigation:save');
	await db.delete('navigation:enabled');
	await db.sortedSetAdd('navigation:enabled', order, items);
};

admin.getAdmin = async function () {
	const [enabled, available] = await Promise.all([
		admin.get(),
		getAvailable(),
	]);
	return { enabled: enabled, available: available };
};

admin.get = async function () {
	if (cache) {
		return _.cloneDeep(cache);
	}
	const data = await db.getSortedSetRange('navigation:enabled', 0, -1);
	cache = data.map(function (item) {
		item = JSON.parse(item);
		item.groups = item.groups || [];
		if (item.groups && !Array.isArray(item.groups)) {
			item.groups = [item.groups];
		}
		return item;
	});

	return _.cloneDeep(cache);
};

async function getAvailable() {
	const core = require('../../install/data/navigation.json').map(function (item) {
		item.core = true;
		item.id = item.id || '';
		item.properties = item.properties || { targetBlank: false };

		return item;
	});

	return await plugins.fireHook('filter:navigation.available', core);
}

require('../promisify')(admin);
