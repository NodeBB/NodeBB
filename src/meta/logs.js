'use strict';

var path = require('path');
var nconf = require('nconf');
var fs = require('fs');
var winston = require('winston');

module.exports = function (Meta) {
	Meta.logs = {
		path: path.join(nconf.get('base_dir'), 'logs', 'output.log'),
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
