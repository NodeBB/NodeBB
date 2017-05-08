'use strict';

var path = require('path');
var fs = require('fs');
var winston = require('winston');

module.exports = function (Meta) {
	Meta.logs = {
		path: path.join(__dirname, '..', '..', 'logs', 'output.log'),
	};

	Meta.logs.get = function (callback) {
		fs.readFile(Meta.logs.path, {
			encoding: 'utf-8',
		}, function (err, logs) {
			if (err) {
				winston.error('[meta/logs] Could not retrieve logs: ' + err.message);
			}

			callback(undefined, logs || '');
		});
	};

	Meta.logs.clear = function (callback) {
		fs.truncate(Meta.logs.path, 0, callback);
	};
};
