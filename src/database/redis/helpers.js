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

helpers.objectFieldsToString = function (obj) {
	const stringified = Object.fromEntries(
		Object.entries(obj).map(([key, value]) => [key, String(value)])
	);
	return stringified;
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
