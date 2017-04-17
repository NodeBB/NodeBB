'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../database');
var analytics = require('../analytics');

module.exports = function (Meta) {
	Meta.errors = {};

	Meta.errors.log404 = function (route, callback) {
		callback = callback || function () {};
		route = route.replace(/\/$/, '');	// remove trailing slashes
		analytics.increment('errors:404');
		db.sortedSetIncrBy('errors:404', 1, route, callback);
	};

	Meta.errors.get = function (escape, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRangeWithScores('errors:404', 0, -1, next);
			},
			function (data, next) {
				data = data.map(function (nfObject) {
					nfObject.value = escape ? validator.escape(String(nfObject.value || '')) : nfObject.value;
					return nfObject;
				});

				next(null, data);
			},
		], callback);
	};

	Meta.errors.clear = function (callback) {
		db.delete('errors:404', callback);
	};
};
