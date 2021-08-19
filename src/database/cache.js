'use strict';

module.exports.create = function (name) {
	const cacheCreate = require('../cacheCreate');
	return cacheCreate({
		name: `${name}-object`,
		max: 40000,
		length: function () { return 1; },
		maxAge: 0,
	});
};
