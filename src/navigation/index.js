"use strict";


var navigation = {},
	admin = require('./admin'),
	translator = require('../../public/src/modules/translator');


navigation.get = function(callback) {
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

		callback(null, data);
	});
};


module.exports = navigation;