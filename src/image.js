'use strict';

var os = require('os');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var async = require('async');

var file = require('./file');
var plugins = require('./plugins');

var image = module.exports;

function requireSharp() {
	var sharp = require('sharp');
	if (os.platform() === 'win32') {
		// https://github.com/lovell/sharp/issues/1259
		sharp.cache(false);
	}
	return sharp;
}

image.resizeImage = function (data, callback) {
	if (plugins.hasListeners('filter:image.resize')) {
		plugins.fireHook('filter:image.resize', {
			path: data.path,
			target: data.target,
			width: data.width,
			height: data.height,
			quality: data.quality,
		}, function (err) {
			callback(err);
		});
	} else {
		var sharpImage;
		async.waterfall([
			function (next) {
				fs.readFile(data.path, next);
			},
			function (buffer, next) {
				var sharp = requireSharp();
				sharpImage = sharp(buffer, {
					failOnError: true,
				});
				sharpImage.metadata(next);
			},
			function (metadata, next) {
				sharpImage.rotate(); // auto-orients based on exif data
				sharpImage.resize(data.hasOwnProperty('width') ? data.width : null, data.hasOwnProperty('height') ? data.height : null);

				if (data.quality && metadata.format === 'jpeg') {
					sharpImage.jpeg({ quality: data.quality });
				}

				sharpImage.toFile(data.target || data.path, next);
			},
		], function (err) {
			callback(err);
		});
	}
};

image.normalise = function (path, extension, callback) {
	if (plugins.hasListeners('filter:image.normalise')) {
		plugins.fireHook('filter:image.normalise', {
			path: path,
		}, function (err) {
			callback(err, path + '.png');
		});
	} else {
		var sharp = requireSharp();
		sharp(path, { failOnError: true }).png().toFile(path + '.png', function (err) {
			callback(err, path + '.png');
		});
	}
};

image.size = function (path, callback) {
	if (plugins.hasListeners('filter:image.size')) {
		plugins.fireHook('filter:image.size', {
			path: path,
		}, function (err, image) {
			callback(err, image ? { width: image.width, height: image.height } : undefined);
		});
	} else {
		var sharp = requireSharp();
		sharp(path, { failOnError: true }).metadata(function (err, metadata) {
			callback(err, metadata ? { width: metadata.width, height: metadata.height } : undefined);
		});
	}
};

image.checkDimensions = function (path, callback) {
	const meta = require('./meta');
	image.size(path, function (err, result) {
		if (err) {
			return callback(err);
		}

		const maxWidth = meta.config.rejectImageWidth;
		const maxHeight = meta.config.rejectImageHeight;
		if (result.width > maxWidth || result.height > maxHeight) {
			return callback(new Error('[[error:invalid-image-dimensions]]'));
		}

		callback();
	});
};

image.convertImageToBase64 = function (path, callback) {
	fs.readFile(path, 'base64', callback);
};

image.mimeFromBase64 = function (imageData) {
	return imageData.slice(5, imageData.indexOf('base64') - 1);
};

image.extensionFromBase64 = function (imageData) {
	return file.typeToExtension(image.mimeFromBase64(imageData));
};

image.writeImageDataToTempFile = function (imageData, callback) {
	var filename = crypto.createHash('md5').update(imageData).digest('hex');

	var type = image.mimeFromBase64(imageData);
	var extension = file.typeToExtension(type);

	var filepath = path.join(os.tmpdir(), filename + extension);

	var buffer = Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64');

	fs.writeFile(filepath, buffer, {
		encoding: 'base64',
	}, function (err) {
		callback(err, filepath);
	});
};

image.sizeFromBase64 = function (imageData) {
	return Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64').length;
};

image.uploadImage = function (filename, folder, image, callback) {
	if (plugins.hasListeners('filter:uploadImage')) {
		return plugins.fireHook('filter:uploadImage', {
			image: image,
			uid: image.uid,
		}, callback);
	}

	async.waterfall([
		function (next) {
			file.isFileTypeAllowed(image.path, next);
		},
		function (next) {
			file.saveFileToLocal(filename, folder, image.path, next);
		},
		function (upload, next) {
			next(null, {
				url: upload.url,
				path: upload.path,
				name: image.name,
			});
		},
	], callback);
};
