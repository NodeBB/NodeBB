"use strict";


var navigation = {},
	plugins = require('../plugins');


navigation.load = function(callback) {
	callback(false, []);
};


module.exports = navigation;