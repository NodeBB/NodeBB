'use strict';

var async = require('async');
var plugins = require('../plugins');
var db = require('../database');
var translator = require('../translator');
var pubsub = require('../pubsub');

var admin = module.exports;
admin.cache = null;

pubsub.on('admin:navigation:save', function () {
	admin.cache = null;
});

admin.save = function (data, callback) {
	var order = Object.keys(data);
	var items = data.map(function (item, idx) {
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
	pubsub.publish('admin:navigation:save');
	async.waterfall([
		function (next) {
			db.delete('navigation:enabled', next);
		},
		function (next) {
			db.sortedSetAdd('navigation:enabled', order, items, next);
		},
	], callback);
};

admin.getAdmin = function (callback) {
	async.parallel({
		enabled: admin.get,
		available: getAvailable,
	}, callback);
};

admin.get = function (callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('navigation:enabled', 0, -1, next);
		},
		function (data, next) {
			data = data.map(function (item, idx) {
				return JSON.parse(item)[idx];
			});

			next(null, data);
		},
	], callback);
};

function getAvailable(callback) {
	var core = require('../../install/data/navigation.json').map(function (item) {
		item.core = true;
		return item;
	});

	plugins.fireHook('filter:navigation.available', core, callback);
}
