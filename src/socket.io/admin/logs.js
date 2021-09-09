'use strict';

const meta = require('../../meta');
const Logs = module.exports;

Logs.get = function (socket, data, callback) {
	meta.logs.get(callback);
};

Logs.clear = function (socket, data, callback) {
	meta.logs.clear(callback);
};
