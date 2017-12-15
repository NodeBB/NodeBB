'use strict';

var async = require('async');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var winston = require('winston');

var filePath = path.join(__dirname, '../../build/cache-buster');

var cached;

// cache buster is an 11-character, lowercase, alphanumeric string
function generate() {
	return (Math.random() * 1e18).toString(32).slice(0, 11);
}

exports.write = function write(callback) {
	async.waterfall([
		function (next) {
			mkdirp(path.dirname(filePath), next);
		},
		function (data, next) {
			fs.writeFile(filePath, generate(), next);
		},
	], callback);
};

exports.read = function read(callback) {
	if (cached) {
		return callback(null, cached);
	}

	fs.readFile(filePath, 'utf8', function (err, buster) {
		if (err) {
			winston.warn('[cache-buster] could not read cache buster', err);
			return callback(null, generate());
		}

		if (!buster || buster.length !== 11) {
			winston.warn('[cache-buster] cache buster string invalid: expected /[a-z0-9]{11}/, got `' + buster + '`');
			return callback(null, generate());
		}

		cached = buster;
		callback(null, cached);
	});
};
