'use strict';

var fs = require('fs'),
	lwip = require('lwip'),
	plugins = require('./plugins');

var image = {};

image.resizeImage = function(path, extension, width, height, callback) {
	if (plugins.hasListeners('filter:image.resize')) {
		plugins.fireHook('filter:image.resize', {
			path: path,
			extension: extension,
			width: width,
			height: height
		}, function(err, data) {
			callback(err);
		});
	} else {
		tryOpen(path, function(err, image) {
			if (err) {
				return callback(err);
			}

			image.batch()
				.cover(width, height)
				.crop(width, height)
				.writeFile(path, function(err) {
					callback(err);
				});
			});
	}
};

image.normalise = function(path, extension, callback) {
	if (plugins.hasListeners('filter:image.normalise')) {
		plugins.fireHook('filter:image.normalise', {
			path: path,
			extension: extension
		}, function(err, data) {
			callback(err);
		});
	} else {
		tryOpen(path, function(err, image) {
			if (err) {
				return callback(err);
			}
			image.writeFile(path, 'png', callback);
		});
	}
};

function tryOpen(path, callback) {
	try {
		lwip.open(path, callback);
	} catch (err) {
		callback(err);
	}
}

image.convertImageToBase64 = function(path, callback) {
	fs.readFile(path, function(err, data) {
		callback(err, data ? data.toString('base64') : null);
	});
};

module.exports = image;
