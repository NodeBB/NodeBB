'use strict';

var fs = require('fs'),
	Jimp = require('jimp'),
	async = require('async'),
	plugins = require('./plugins');

var image = {};

image.resizeImage = function(data, callback) {
	if (plugins.hasListeners('filter:image.resize')) {
		plugins.fireHook('filter:image.resize', {
			path: data.path,
			target: data.target,
			extension: data.extension,
			width: data.width,
			height: data.height
		}, function(err) {
			callback(err);
		});
	} else {
		new Jimp(data.path, function(err, image) {
			if (err) {
				return callback(err);
			}

			var w = image.bitmap.width,
				h = image.bitmap.height,
				origRatio = w/h,
				desiredRatio = data.width && data.height ? data.width/data.height : origRatio,
				x = 0,
				y = 0,
				crop;

			if (origRatio !== desiredRatio) {
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
			} else {
				// Simple resize given either width, height, or both
				crop = async.apply(setImmediate);
			}

			async.waterfall([
				crop,
				function(_image, next) {
					if (typeof _image === 'function' && !next) {
						next = _image;
						_image = image;
					}

					if ((data.width && data.height) || (w > data.width) || (h > data.height)) {
						_image.resize(data.width || Jimp.AUTO, data.height || Jimp.AUTO, next);
					} else {
						next(null, image);
					}
				},
				function(image, next) {
					image.write(data.target || data.path, next);
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
		}, function(err) {
			callback(err);
		});
	} else {
		new Jimp(path, function(err, image) {
			if (err) {
				return callback(err);
			}
			image.write(path + '.png', function(err) {
				callback(err);
			});
		});
	}
};

image.load = function(path, callback) {
	new Jimp(path, function(err, data) {
		callback(err, data ? data.bitmap : null);
	});
};

image.convertImageToBase64 = function(path, callback) {
	fs.readFile(path, function(err, data) {
		callback(err, data ? data.toString('base64') : null);
	});
};

module.exports = image;
