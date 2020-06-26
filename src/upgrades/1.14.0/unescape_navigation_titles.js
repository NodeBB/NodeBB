'use strict';

var async = require('async');
var db = require('../../database');

module.exports = {
	name: 'Unescape navigation titles',
	timestamp: Date.UTC(2020, 5, 26),
	method: async function () {
		const data = await db.getSortedSetRangeWithScores('navigation:enabled', 0, -1);
		const translator = require('../../translator');
		var order = [];
		var items = [];
		data.forEach(function (item) {
			var navItem = JSON.parse(item.value);
			var keys = Object.keys(navItem);
			if (navItem.hasOwnProperty('title')) {
				navItem.title = translator.unescape(navItem.title);
			}
			if (navItem.hasOwnProperty('text')) {
				navItem.text = translator.unescape(navItem.text);
			}
			order.push(item.score);
			items.push(JSON.stringify(navItem));
		});
		await db.delete('navigation:enabled');
		await db.sortedSetAdd('navigation:enabled', order, items);
	},
};
