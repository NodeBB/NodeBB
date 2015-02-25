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

admin.getAvailable = function(data, callback) {
	var core = require('../../install/data/navigation.json');
	plugins.fireHook('filter:navigation.available', core, callback);
};

module.exports = admin;