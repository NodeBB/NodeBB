"use strict";


var navigation = {};
var admin = require('./admin');
var translator = require('../../public/src/modules/translator');

navigation.get = function(callback) {
	if (admin.cache) {
		return callback(null, admin.cache);
	}

	admin.get(function(err, data) {
		if (err) {
			return callback(err);
		}

		data = data.filter(function(item) {
			return item && item.enabled;
		}).map(function(item) {
			for (var i in item) {
				if (item.hasOwnProperty(i)) {
					item[i] = translator.unescape(item[i]);
				}
			}
			return item;
		});

		admin.cache = data;

		callback(null, data);
	});
};


module.exports = navigation;