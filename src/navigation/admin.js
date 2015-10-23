"use strict";


var admin = {},
	async = require('async'),
	plugins = require('../plugins'),
	db = require('../database'),
	translator = require('../../public/src/modules/translator');

var navigationCache = null;

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

	navigationCache = null;
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
	if (navigationCache) {
		return callback(null, navigationCache);
	}

	db.getSortedSetRange('navigation:enabled', 0, -1, function(err, data) {
		if (err) {
			return callback(err);
		}
		navigationCache = data.map(function(item, idx) {
			return JSON.parse(item)[idx];
		});

		callback(null, navigationCache);
	});
};

function getAvailable(callback) {
	var core = require('../../install/data/navigation.json').map(function(item) {
		item.core = true;
		return item;
	});

	// DEPRECATION: backwards compatibility for filter:header.build, will be removed soon.
	plugins.fireHook('filter:header.build', {navigation: []}, function(err, data) {
		core = core.concat(data.navigation);

		plugins.fireHook('filter:navigation.available', core, callback);
	});
}

module.exports = admin;