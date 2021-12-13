'use strict';

const validator = require('validator');

const plugins = require('../plugins');
const db = require('../database');
const pubsub = require('../pubsub');

const admin = module.exports;
let cache = null;

pubsub.on('admin:navigation:save', () => {
	cache = null;
});

admin.save = async function (data) {
	const order = Object.keys(data);
	const bulkSet = [];
	data.forEach((item, index) => {
		item.order = order[index];
		if (item.hasOwnProperty('groups')) {
			item.groups = JSON.stringify(item.groups);
		}
		bulkSet.push([`navigation:enabled:${item.order}`, item]);
	});

	cache = null;
	pubsub.publish('admin:navigation:save');
	await db.setObjectBulk(bulkSet);
	await db.delete('navigation:enabled');
	await db.sortedSetAdd('navigation:enabled', order, order);
};

admin.getAdmin = async function () {
	const [enabled, available] = await Promise.all([
		admin.get(),
		getAvailable(),
	]);
	return { enabled: enabled, available: available };
};

const fieldsToEscape = ['iconClass', 'class', 'route', 'id', 'text', 'textClass', 'title'];

admin.escapeFields = navItems => toggleEscape(navItems, true);
admin.unescapeFields = navItems => toggleEscape(navItems, false);

function toggleEscape(navItems, flag) {
	navItems.forEach((item) => {
		if (item) {
			fieldsToEscape.forEach((field) => {
				if (item.hasOwnProperty(field)) {
					item[field] = validator[flag ? 'escape' : 'unescape'](String(item[field]));
				}
			});
		}
	});
}

admin.get = async function () {
	if (cache) {
		return cache.map(item => ({ ...item }));
	}
	const ids = await db.getSortedSetRange('navigation:enabled', 0, -1);
	const data = await db.getObjects(ids.map(id => `navigation:enabled:${id}`));
	cache = data.map((item) => {
		if (item.hasOwnProperty('groups')) {
			item.groups = JSON.parse(item.groups);
		}
		item.groups = item.groups || [];
		if (item.groups && !Array.isArray(item.groups)) {
			item.groups = [item.groups];
		}
		return item;
	});
	admin.escapeFields(cache);

	return cache.map(item => ({ ...item }));
};

async function getAvailable() {
	const core = require('../../install/data/navigation.json').map((item) => {
		item.core = true;
		item.id = item.id || '';
		return item;
	});

	return await plugins.hooks.fire('filter:navigation.available', core);
}

require('../promisify')(admin);
