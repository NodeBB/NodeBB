'use strict';

const helpers = module.exports;
const utils = require('../../utils');

helpers.noop = function () {};

helpers.toMap = function (data) {
	const map = {};
	for (let i = 0; i < data.length; i += 1) {
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


	// tigris doesn't allow '-' in field names, replace '-'s with '___'
	field = field.replace(/-/g, '___');

	// tigris doesn't allow ':' in field names, replace ':'s with '__'
	field = field.replace(/:/g, '__');

	// if there is a '.' in the field name it inserts subdocument in mongo, replace '.'s with \uff0E
	return field.replace(/\./g, '\uff0E');
};

helpers.stringToField = function (field) {
	if (field === null || field === undefined) {
		return field;
	}

	if (typeof field !== 'string') {
		field = field.toString();
	}

	// tigris doesn't allow '-' in field names, replace '___'s with  '-'
	field = field.replace(/___/g, '-');

	// tigris doesn't allow ':' in field names, replace '__'s with ':'
	field = field.replace(/__/g, ':');

	// if there is a '.' in the field name it inserts subdocument in mongo, replace '.'s with \uff0E
	return field.replace(/\uff0E/g, '.');
};

helpers.serializeData = function (data) {
	const serialized = {};
	for (const [field, value] of Object.entries(data)) {
		if (field !== '') {
			serialized[helpers.fieldToString(field)] = value;
		}
	}
	return serialized;
};

helpers.deserializeData = function (data) {
	const deserialized = {};
	for (const [field, value] of Object.entries(data)) {
		deserialized[helpers.stringToField(field)] = value;
	}
	return deserialized;
};

helpers.valueToString = function (value) {
	return String(value);
};

helpers.buildMatchQuery = function (match) {
	let _match = match;
	if (match.startsWith('*')) {
		_match = _match.substring(1);
	}
	if (match.endsWith('*')) {
		_match = _match.substring(0, _match.length - 1);
	}
	_match = utils.escapeRegexChars(_match);
	if (!match.startsWith('*')) {
		_match = `^${_match}`;
	}
	if (!match.endsWith('*')) {
		_match += '$';
	}
	return _match;
};
