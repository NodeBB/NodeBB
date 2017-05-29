'use strict';

var path = require('path');
var fs = require('fs');

module.exports = function (Meta) {
	Meta.logs = {
		path: path.join(__dirname, '..', '..', 'logs', 'output.log'),
	};

	Meta.logs.get = function (callback) {
		fs.readFile(Meta.logs.path, {
			encoding: 'utf-8',
		}, callback);
	};

	Meta.logs.clear = function (callback) {
		fs.truncate(Meta.logs.path, 0, callback);
	};
};
