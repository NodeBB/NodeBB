'use strict';

const meta = require('../../meta');

const Errors = module.exports;

Errors.clear = async function () {
	await meta.errors.clear();
};
