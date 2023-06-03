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

	// tigris doesn't allow '@' in field name, replace '@'s with '____'
	field = field.replace(/@/g, '____');

	// tigris doesn't allow '/' in field name, replace '/'s with '______'
	field = field.replace(/\//g, '______');

	// if there is a '.' in the field name it inserts subdocument in mongo, replace '.'s with '_____'
	return field.replace(/\./g, '_____');
};

helpers.stringToField = function (field) {
	if (field === null || field === undefined) {
		return field;
	}

	if (typeof field !== 'string') {
		field = field.toString();
	}

	// if there is a '/' in the field name it inserts subdocument in mongo, replace '______'s with '/'
	field = field.replace(/______/g, '/');

	// if there is a '.' in the field name it inserts subdocument in mongo, replace '_____'s with '.'
	field = field.replace(/_____/g, '.');

	// tigris doesn't allow '@' in field name, replace '____'s with '@'
	field = field.replace(/____/g, '@');

	// tigris doesn't allow '-' in field names, replace '___'s with  '-'
	field = field.replace(/___/g, '-');

	// tigris doesn't allow ':' in field names, replace '__'s with ':'
	return field.replace(/__/g, ':');
};

helpers.serializeData = function (data) {
	const serialized = {};
	for (let [field, value] of Object.entries(data)) {
		if (field !== '') {
			if (field === 'lastposttime' || field === 'score') {
				value = String(value);
			}

			serialized[helpers.fieldToString(field)] = value;
		}
	}
	return serialized;
};

helpers.deserializeData = function (data) {
	const deserialized = {};
	for (let [field, value] of Object.entries(data)) {
		// TODO can remove this in Tigris
		if (field === 'lastposttime' || field === 'score') {
			value = Number(value);
		}

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
