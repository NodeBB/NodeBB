'use strict';

module.exports = {
	name: 'Navigation item visibility groups',
	timestamp: Date.UTC(2018, 10, 10),
	method: async function () {
		const data = await navigationAdminGet();
		data.forEach((navItem) => {
			if (navItem && navItem.properties) {
				navItem.groups = [];
				if (navItem.properties.adminOnly) {
					navItem.groups.push('administrators');
				} else if (navItem.properties.globalMod) {
					navItem.groups.push('Global Moderators');
				}

				if (navItem.properties.loggedIn) {
					navItem.groups.push('registered-users');
				} else if (navItem.properties.guestOnly) {
					navItem.groups.push('guests');
				}
			}
		});
		await navigationAdminSave(data);
	},
};
// use navigation.get/save as it was in 1.11.0 so upgrade script doesn't crash on latest nbb
// see https://github.com/NodeBB/NodeBB/pull/11013
async function navigationAdminGet() {
	const db = require('../../database');
	const data = await db.getSortedSetRange('navigation:enabled', 0, -1);
	return data.filter(Boolean).map((item) => {
		item = JSON.parse(item);
		item.groups = item.groups || [];
		if (item.groups && !Array.isArray(item.groups)) {
			item.groups = [item.groups];
		}
		return item;
	});
}

async function navigationAdminSave(data) {
	const db = require('../../database');
	const translator = require('../../translator');
	const order = Object.keys(data);
	const items = data.map((item, index) => {
		Object.keys(item).forEach((key) => {
			if (item.hasOwnProperty(key) && typeof item[key] === 'string' && (key === 'title' || key === 'text')) {
				item[key] = translator.escape(item[key]);
			}
		});
		item.order = order[index];
		return JSON.stringify(item);
	});

	await db.delete('navigation:enabled');
	await db.sortedSetAdd('navigation:enabled', order, items);
}
