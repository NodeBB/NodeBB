'use strict';

var fs = require('fs'),
	Jimp = require('jimp'),
	async = require('async'),
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
		new Jimp(path, function(err, image) {
			if (err) {
				return callback(err);
			}

			var w = image.bitmap.width,
				h = image.bitmap.height,
				origRatio = w/h,
				desiredRatio = width/height,
				x = 0,
				y = 0,
				crop;

			if (desiredRatio > origRatio) {
				desiredRatio = 1/desiredRatio;
			}
			if (origRatio >= 1) {
				y = 0;	// height is the smaller dimension here
				x = Math.floor((w/2) - (h * desiredRatio / 2));
				crop = async.apply(image.crop.bind(image), x, y, h * desiredRatio, h);
			} else {
				x = 0;	// width is the smaller dimension here
				y = Math.floor(h/2 - (w * desiredRatio / 2));
				crop = async.apply(image.crop.bind(image), x, y, w, w * desiredRatio);
			}

			async.waterfall([
				crop,
				function(image, next) {
					image.resize(width, height, next);
				},
				function(image, next) {
					image.write(path, next);
				}
			], function(err) {
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
		new Jimp(path, function(err, image) {
			if (err) {
				return callback(err);
			}
			image.write(path + '.png', callback);
		});
	}
};

image.convertImageToBase64 = function(path, callback) {
	fs.readFile(path, function(err, data) {
		callback(err, data ? data.toString('base64') : null);
	});
};

module.exports = image;
