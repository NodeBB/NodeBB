'use strict';

var async = require('async');
var nconf = require('nconf');

var admin = require('./admin');
var translator = require('../translator');

var navigation = module.exports;

navigation.get = function (callback) {
	if (admin.cache) {
		return callback(null, admin.cache);
	}

	async.waterfall([
		admin.get,
		function (data, next) {
			data = data.filter(function (item) {
				return item && item.enabled;
			}).map(function (item) {
				item.originalRoute = item.route;

				if (!item.route.startsWith('http')) {
					item.route = nconf.get('relative_path') + item.route;
				}

				Object.keys(item).forEach(function (key) {
					item[key] = translator.unescape(item[key]);
				});

				return item;
			});

			admin.cache = data;

			next(null, data);
		},
	], callback);
};
