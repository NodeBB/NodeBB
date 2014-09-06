"use strict";

var helpers = {},
	winston = require('winston');

helpers.toMap = function(data) {
	var map = {};
	for (var i = 0; i<data.length; ++i) {
		map[data[i]._key] = data[i];
	}
	return map;
}

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

helpers.checkKeys = function(keys) {
	if (!Array.isArray(keys)) {
		var e = new Error('invalid keys');
		winston.warn('[INVALID_KEYS] ',  e.stack);
		return;
	}
	if (keys.length > 50) {
		var e = new Error('too many keys');
		winston.warn('[TOO_MANY_KEYS] ' + keys.length + ' ' + keys[0] + '  ' + keys[keys.length - 1] + '\n', e.stack);
	}
}

module.exports = helpers;