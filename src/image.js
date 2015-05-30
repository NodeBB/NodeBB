'use strict';

var fs = require('fs'),
	lwip = require('lwip');

var image = {};

image.resizeImage = function(path, extension, width, height, callback) {
	lwip.open(path, function(err, image) {
		image.batch()
			.cover(width, height)
			.crop(width, height)
			.writeFile(path, function(err) {
				callback(err)
			})
		});
};

image.convertImageToPng = function(path, extension, callback) {
	if(extension !== '.png') {
		lwip.open(path, function(err, image) {
			if (err) {
				return callback(err);
			}
			image.writeFile(path, 'png', callback)
		});
	} else {
		callback();
	}
};

image.convertImageToBase64 = function(path, callback) {
	fs.readFile(path, function(err, data) {
		callback(err, data ? data.toString('base64') : null);
	});
};

module.exports = image;
