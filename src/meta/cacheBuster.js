'use strict';

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
	mkdirp(path.dirname(filePath), function (err) {
		if (err) {
			return callback(err);
		}

		fs.writeFile(filePath, generate(), callback);
	});
};

exports.read = function read(callback) {
	if (cached) {
		return callback(null, cached);
	}

	fs.readFile(filePath, function (err, buffer) {
		if (err) {
			winston.warn('[cache-buster] could not read cache buster: ' + err.message);
			return callback();
		}

		buffer = buffer.toString();
		if (buffer) {
			cached = buffer;
			return callback(null, cached);
		}

		callback();
	});
};
