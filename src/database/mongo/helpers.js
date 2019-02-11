'use strict';

var helpers = module.exports;

helpers.noop = function () {};

helpers.toMap = function (data) {
	var map = {};
	for (var i = 0; i < data.length; i += 1) {
		map[data[i]._key] = data[i];
		delete data[i]._key;
	}
	return map;
};

helpers.fieldToString = function (field) {
	if (field === null || field === undefined) {
		return field;
	}

	if (typeof field !== 'string') {
		field = field.toString();
	}
	// if there is a '.' in the field name it inserts subdocument in mongo, replace '.'s with \uff0E
	return field.replace(/\./g, '\uff0E');
};

helpers.serializeData = function (data) {
	const serialized = {};
	for (const field in data) {
		if (data.hasOwnProperty(field) && field !== '') {
			serialized[helpers.fieldToString(field)] = data[field];
		}
	}
	return serialized;
};

helpers.deserializeData = function (data) {
	const deserialized = {};
	for (const field in data) {
		if (data.hasOwnProperty(field)) {
			deserialized[field.replace(/\uff0E/g, '.')] = data[field];
		}
	}
	return deserialized;
};

helpers.valueToString = function (value) {
	return String(value);
};
