"use strict";


var navigation = {},
	plugins = require('../plugins'),
	db = require('../database'),
	admin = require('./admin'),
	translator = require('../../public/src/translator');


navigation.get = function(callback) {
	admin.get(function(err, data) {
		callback(err, data
			.filter(function(item) {
				return item.enabled;
			})
			.map(function(item) {
				console.log(item);
				for (var i in item) {
					if (item.hasOwnProperty(i)) {
						console.log(item[i]);
						item[i] = translator.unescape(item[i]);
					}
				}

				return item;
			}));
	});
};


module.exports = navigation;