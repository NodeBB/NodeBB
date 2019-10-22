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

helpers.zsetToObjectArray = function (data) {
	const objects = new Array(data.length / 2);
	for (let i = 0, k = 0; i < objects.length; i += 1, k += 2) {
		objects[i] = { value: data[k], score: parseFloat(data[k + 1]) };
	}
	return objects;
};
