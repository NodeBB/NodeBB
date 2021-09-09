'use strict';

var async = require('async');
var db = require('../../database');

module.exports = {
	name: 'Flatten navigation data',
	timestamp: Date.UTC(2018, 1, 17),
	method: function (callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRangeWithScores('navigation:enabled', 0, -1, next);
			},
			function (data, next) {
				var order = [];
				var items = [];
				data.forEach(function (item) {
					var navItem = JSON.parse(item.value);
					var keys = Object.keys(navItem);
					if (keys.length && parseInt(keys[0], 10) >= 0) {
						navItem = navItem[keys[0]];
					}
					order.push(item.score);
					items.push(JSON.stringify(navItem));
				});

				async.series([
					function (next) {
						db.delete('navigation:enabled', next);
					},
					function (next) {
						db.sortedSetAdd('navigation:enabled', order, items, next);
					},
				], next);
			},
		], callback);
	},
};
