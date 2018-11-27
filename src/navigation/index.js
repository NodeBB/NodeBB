'use strict';

var async = require('async');
var nconf = require('nconf');

var admin = require('./admin');
var translator = require('../translator');
const groups = require('../groups');

var navigation = module.exports;

navigation.get = function (uid, callback) {
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

			async.filter(data, function (navItem, next) {
				if (!navItem.groups.length) {
					return setImmediate(next, null, true);
				}
				groups.isMemberOfAny(uid, navItem.groups, next);
			}, next);
		},
	], callback);
};
