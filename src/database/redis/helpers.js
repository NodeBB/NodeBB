'use strict';

const util = require('util');

var helpers = module.exports;

helpers.noop = function () {};

helpers.execBatch = async function (batch) {
	const proFn = util.promisify(batch.exec).bind(batch);
	return await proFn();
};

helpers.resultsToBool = function (results) {
	for (var i = 0; i < results.length; i += 1) {
		results[i] = results[i] === 1;
	}
	return results;
};
