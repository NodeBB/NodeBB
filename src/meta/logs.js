'use strict';

var path = require('path'),
	fs = require('fs'),
	winston = require('winston');

module.exports = function(Meta) {

	Meta.logs = {
		path: path.join('logs', path.sep, 'output.log')
	};

	Meta.logs.get = function(callback) {
		fs.readFile(this.path, {
			encoding: 'utf-8'
		}, function(err, logs) {
			if (err) {
				winston.error('[meta/logs] Could not retrieve logs: ' + err.message);
			}

			callback(undefined, logs || '');
		});
	};

	Meta.logs.clear = function(callback) {
		fs.truncate(this.path, 0, callback);
	};
};