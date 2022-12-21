'use strict';

const db = require('../../database');

module.exports = {
	name: 'Upgrade navigation items to hashes',
	timestamp: Date.UTC(2021, 11, 13),
	method: async function () {
		const data = await db.getSortedSetRangeWithScores('navigation:enabled', 0, -1);
		const order = [];
		const bulkSet = [];

		data.forEach((item) => {
			const navItem = JSON.parse(item.value);
			if (navItem.hasOwnProperty('properties') && navItem.properties) {
				if (navItem.properties.hasOwnProperty('targetBlank')) {
					navItem.targetBlank = navItem.properties.targetBlank;
				}
				delete navItem.properties;
			}
			if (navItem.hasOwnProperty('groups') && (Array.isArray(navItem.groups) || typeof navItem.groups === 'string')) {
				navItem.groups = JSON.stringify(navItem.groups);
			}
			bulkSet.push([`navigation:enabled:${item.score}`, navItem]);
			order.push(item.score);
		});
		await db.setObjectBulk(bulkSet);
		await db.delete('navigation:enabled');
		await db.sortedSetAdd('navigation:enabled', order, order);
	},
};
