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
				if (!item.route.startsWith('http')) {
					item.route = nconf.get('relative_path') + item.route;
				}

				for (var i in item) {
					if (item.hasOwnProperty(i)) {
						item[i] = translator.unescape(item[i]);
					}
				}
				return item;
			});

			admin.cache = data;

			next(null, data);
		},
	], callback);
};


module.exports = navigation;
