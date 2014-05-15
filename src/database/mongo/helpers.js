"use strict";

var helpers = {};

helpers.findItem = function(data, key) {
	if(!data) {
		return null;
	}

	for(var i=0; i<data.length; ++i) {
		if(data[i]._key === key) {
			var item = data.splice(i, 1);
			if(item && item.length) {
				return item[0];
			} else {
				return null;
			}
		}
	}
	return null;
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

helpers.done = function(cb) {
	return function(err, result) {
		if (typeof cb === 'function') {
			cb(err, result);
		}
	};
};

module.exports = helpers;