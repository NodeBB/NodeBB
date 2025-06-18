'use strict';

const helpers = module.exports;

helpers.noop = function () {};

helpers.execBatch = async function (batch) {
	const results = await batch.execAsPipeline();
	return results;
};

helpers.resultsToBool = function (results) {
	for (let i = 0; i < results.length; i += 1) {
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

helpers.normalizeLexRange = function (min, max, reverse) {
	let minmin;
	let maxmax;
	if (reverse) {
		minmin = '+';
		maxmax = '-';
	} else {
		minmin = '-';
		maxmax = '+';
	}

	if (min !== minmin && !min.match(/^[[(]/)) {
		min = `[${min}`;
	}
	if (max !== maxmax && !max.match(/^[[(]/)) {
		max = `[${max}`;
	}
	return { lmin: min, lmax: max };
};
