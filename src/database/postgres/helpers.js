'use strict';

var helpers = {};

helpers.valueToString = function (value) {
	if (value === null || value === undefined) {
		return value;
	}

	return value.toString();
};

helpers.removeDuplicateValues = function (values) {
	var others = Array.prototype.slice.call(arguments, 1);
	for (var i = 0; i < values.length; i++) {
		if (values.lastIndexOf(values[i]) !== i) {
			values.splice(i, 1);
			for (var j = 0; j < others.length; j++) {
				others[j].splice(i, 1);
			}
			i -= 1;
		}
	}
};

helpers.noop = function () {};

module.exports = helpers;
