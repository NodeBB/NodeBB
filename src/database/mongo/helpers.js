"use strict";

var helpers = {},
	winston = require('winston');

helpers.toMap = function(data) {
	var map = {};
	for (var i = 0; i<data.length; ++i) {
		map[data[i]._key] = data[i];
	}
	return map;
};

helpers.fieldToString = function(field) {
	if(field === null || field === undefined) {
		return field;
	}

	if(typeof field !== 'string') {
		field = field.toString();
	}
	// if there is a '.' in the field name it inserts subdocument in mongo, replace '.'s with \uff0E
	field = field.replace(/\./g, '\uff0E');
	return field;
};

helpers.valueToString = function(value) {
	if(value === null || value === undefined) {
		return value;
	}

	return value.toString();
};

helpers.noop = function() {};

module.exports = helpers;