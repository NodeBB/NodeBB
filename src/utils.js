'use strict';

const crypto = require('crypto');

module.exports = require('../public/src/utils');

module.exports.generateUUID = function () {
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