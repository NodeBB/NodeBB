'use strict';

var fs = require('fs'),
	gm = require('gm').subClass({imageMagick: true}),
	meta = require('./meta');

var image = {};

image.resizeImage = function(path, extension, width, height, callback) {
	function done(err, stdout, stderr) {
		callback(err);
	}

	if(extension === '.gif') {
		gm().in(path)
			.in('-coalesce')
			.in('-resize')
			.in(width+'x'+height+'^')
			.write(path, done);
	} else {
		gm(path)
			.in('-resize')
			.in(width+'x'+height+'^')
			.gravity('Center')
			.crop(width, height)
			.write(path, done);
	}
};

image.convertImageToPng = function(path, extension, callback) {
	var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10);
	if(convertToPNG && extension !== '.png') {
		gm(path).toBuffer('png', function(err, buffer) {
			if (err) {
				return callback(err);
			}
			fs.writeFile(path, buffer, 'binary', callback);
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
