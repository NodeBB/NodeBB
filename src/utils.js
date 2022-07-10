'use strict';

const crypto = require('crypto');

process.profile = function (operation, start) {
	console.log('%s took %d milliseconds', operation, process.elapsedTimeSince(start));
};

process.elapsedTimeSince = function (start) {
	const diff = process.hrtime(start);
	return (diff[0] * 1e3) + (diff[1] / 1e6);
};
const utils = { ...require('../public/src/utils.common') };

utils.getLanguage = function () {
	const meta = require('./meta');
	return meta.config && meta.config.defaultLang ? meta.config.defaultLang : 'en-GB';
};

utils.generateUUID = function () {
	// from https://github.com/tracker1/node-uuid4/blob/master/index.js
	let rnd = crypto.randomBytes(16);
	/* eslint-disable no-bitwise */
	rnd[6] = (rnd[6] & 0x0f) | 0x40;
	rnd[8] = (rnd[8] & 0x3f) | 0x80;
	/* eslint-enable no-bitwise */
	rnd = rnd.toString('hex').match(/(.{8})(.{4})(.{4})(.{4})(.{12})/);
	rnd.shift();
	return rnd.join('-');
};

module.exports = utils;
