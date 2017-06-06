'use strict';

var path = require('path');
var fs = require('fs');

var Logs = module.exports;

Logs.path = path.join(__dirname, '..', '..', 'logs', 'output.log');

Logs.get = function (callback) {
	fs.readFile(Logs.path, {
		encoding: 'utf-8',
	}, callback);
};

Logs.clear = function (callback) {
	fs.truncate(Logs.path, 0, callback);
};
