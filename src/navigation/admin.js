"use strict";


var admin = {},
	async = require('async'),
	plugins = require('../plugins'),
	db = require('../database'),
	translator = require('../../public/src/translator');


admin.save = function(data, callback) {
	var order = Object.keys(data),
		items = data.map(function(item, idx) {
			var data = {};

			for (var i in item) {
				if (item.hasOwnProperty(i)) {
					item[i] = typeof item[i] === 'string' ? translator.escape(item[i]) : item[i];
				}
			}

			data[idx] = item;
			return JSON.stringify(data);
		});

	async.waterfall([
		function(next) {
			db.delete('navigation:enabled', next);
		},
		function(next) {
			db.sortedSetAdd('navigation:enabled', order, items, next);
		}
	], callback);
};

admin.get = function(callback) {
	async.parallel({
		enabled: require('./index').get,
		available: getAvailable
	}, callback);
};

function getAvailable(callback) {
	var core = require('../../install/data/navigation.json').map(function(item) {
		item.core = true;
		return item;
	});

	plugins.fireHook('filter:navigation.available', core, callback);
}

module.exports = admin;