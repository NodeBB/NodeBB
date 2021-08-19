'use strict';

const meta = require('../../meta');

const Errors = module.exports;

Errors.clear = function (socket, data, callback) {
	meta.errors.clear(callback);
};
