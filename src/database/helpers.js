'use strict';

const helpers = module.exports;

helpers.mergeBatch = function (batchData, start, stop, sort) {
	function getFirst() {
		let selectedArray = batchData[0];
		for (let i = 1; i < batchData.length; i++) {
			if (batchData[i].length && (
				!selectedArray.length ||
				(sort === 1 && batchData[i][0].score < selectedArray[0].score) ||
				(sort === -1 && batchData[i][0].score > selectedArray[0].score)
			)) {
				selectedArray = batchData[i];
			}
		}
		return selectedArray.length ? selectedArray.shift() : null;
	}
	let item;
	const result = [];
	do {
		item = getFirst(batchData);
		if (item) {
			result.push(item);
		}
	} while (item && (result.length < (stop - start + 1) || stop === -1));
	return result;
};

helpers.globToRegex = function (match) {
	if (!match) {
		return '^.*$';
	}
	let _match = match.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	_match = _match.replace(/\*/g, '.*').replace(/\?/g, '.');

	if (!match.startsWith('*')) {
		_match = '^' + _match;
	}
	if (!match.endsWith('*')) {
		_match = _match + '$';
	}
	return _match;
};
