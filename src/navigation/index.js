"use strict";


var navigation = {},
	plugins = require('../plugins'),
	db = require('../database');


navigation.get = function(callback) {
	db.getSortedSetRange('navigation:enabled', 0, -1, function(err, data) {

		data = data
			.filter(function(item) {
				return item.enabled;
			})
			.map(function(item) {
				return JSON.parse(item);
			});

		callback(err, data);
	})
};


module.exports = navigation;