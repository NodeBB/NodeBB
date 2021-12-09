'use strict';

const meta = require('../../meta');

const Logs = module.exports;

Logs.get = async function () {
	return await meta.logs.get();
};

Logs.clear = function () {
	return await meta.logs.clear();
};
