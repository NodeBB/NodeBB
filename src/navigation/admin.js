"use strict";


var admin = {},
	async = require('async'),
	plugins = require('../plugins'),
	db = require('../database'),
	translator = require('../../public/src/modules/translator');

admin.cache = null;

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

	admin.cache = null;
	async.waterfall([
		function(next) {
			db.delete('navigation:enabled', next);
		},
		function(next) {
			db.sortedSetAdd('navigation:enabled', order, items, next);
		}
	], callback);
};

admin.getAdmin = function(callback) {
	async.parallel({
		enabled: admin.get,
		available: getAvailable
	}, callback);
};

admin.get = function(callback) {
	db.getSortedSetRange('navigation:enabled', 0, -1, function(err, data) {
		if (err) {
			return callback(err);
		}

		data = data.map(function(item, idx) {
			return JSON.parse(item)[idx];
		});

		callback(null, data);
	});
};

function getAvailable(callback) {
	var core = require('../../install/data/navigation.json').map(function(item) {
		item.core = true;
		return item;
	});

	plugins.fireHook('filter:navigation.available', core, callback);
}

module.exports = admin;