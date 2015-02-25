"use strict";


var navigation = {},
	plugins = require('../plugins'),
	db = require('../database');


navigation.get = function(callback) {
	db.getSortedSetRange('navigation:enabled', 0, -1, function(err, data) {
		callback(err, data.map(function(item) {
			return JSON.parse(item);
		}));
	});
};


module.exports = navigation;