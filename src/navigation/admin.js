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
	var items = data.map(function (item, index) {
		for (var i in item) {
			if (item.hasOwnProperty(i) && typeof item[i] === 'string' && (i === 'title' || i === 'text')) {
				item[i] = translator.escape(item[i]);
			}
		}
		item.order = order[index];
		return JSON.stringify(item);
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
			data = data.map(function (item) {
				return JSON.parse(item);
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
