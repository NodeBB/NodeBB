"use strict";


var admin = {},
	async = require('async'),
	plugins = require('../plugins'),
	db = require('../database');


admin.save = function(data, callback) {
	var order = Object.keys(data),
		items = data.map(function(item) {
			return JSON.stringify(item);
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