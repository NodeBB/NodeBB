'use strict';

var async = require('async');
var winston = require('winston');

var plugins = require('../plugins');
var file = require('../file');
var image = require('../image');
var meta = require('../meta');
var db = require('../database');

module.exports = function (User) {
	User.updateCoverPosition = function (uid, position, callback) {
		// Reject anything that isn't two percentages
		if (!/^[\d.]+%\s[\d.]+%$/.test(position)) {
			winston.warn('[user/updateCoverPosition] Invalid position received: ' + position);
			return callback(new Error('[[error:invalid-data]]'));
		}

		User.setUserField(uid, 'cover:position', position, callback);
	};

	User.updateCoverPicture = function (data, callback) {
		var url;
		var picture = {
			name: 'profileCover',
			uid: data.uid,
		};

		if (!data.imageData && data.position) {
			return User.updateCoverPosition(data.uid, data.position, callback);
		}

		if (!data.imageData && !data.file) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				var size = data.file ? data.file.size : image.sizeFromBase64(data.imageData);
				meta.config.maximumCoverImageSize = meta.config.maximumCoverImageSize || 2048;
				if (size > parseInt(meta.config.maximumCoverImageSize, 10) * 1024) {
					return next(new Error('[[error:file-too-big, ' + meta.config.maximumCoverImageSize + ']]'));
				}

				if (data.file) {
					return setImmediate(next, null, data.file.path);
				}

				image.writeImageDataToTempFile(data.imageData, next);
			},
			function (path, next) {
				picture.path = path;

				var type = data.file ? data.file.type : image.mimeFromBase64(data.imageData);
				if (!type || !type.match(/^image./)) {
					return next(new Error('[[error:invalid-image]]'));
				}

				var extension = file.typeToExtension(type);
				var filename = generateProfileImageFilename(data.uid, 'profilecover', extension);
				uploadProfileOrCover(filename, picture, next);
			},
			function (uploadData, next) {
				url = uploadData.url;
				User.setUserField(data.uid, 'cover:url', uploadData.url, next);
			},
			function (next) {
				if (data.position) {
					User.updateCoverPosition(data.uid, data.position, next);
				} else {
					setImmediate(next);
				}
			},
		], function (err) {
			file.delete(picture.path);
			callback(err, {
				url: url,
			});
		});
	};

	User.uploadCroppedPicture = function (data, callback) {
		if (parseInt(meta.config.allowProfileImageUploads, 10) !== 1) {
			return callback(new Error('[[error:profile-image-uploads-disabled]]'));
		}

		if (!data.imageData && !data.file) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var size = data.file ? data.file.size : image.sizeFromBase64(data.imageData);
		var uploadSize = parseInt(meta.config.maximumProfileImageSize, 10) || 256;
		if (size > uploadSize * 1024) {
			return callback(new Error('[[error:file-too-big, ' + uploadSize + ']]'));
		}

		var type = data.file ? data.file.type : image.mimeFromBase64(data.imageData);
		if (!type || !type.match(/^image./)) {
			return callback(new Error('[[error:invalid-image]]'));
		}
		var extension = file.typeToExtension(type);
		if (!extension) {
			return callback(new Error('[[error:invalid-image-extension]]'));
		}

		var uploadedImage;

		var picture = {
			name: 'profileAvatar',
			uid: data.uid,
		};

		async.waterfall([
			function (next) {
				if (data.file) {
					return setImmediate(next, null, data.file.path);
				}
				image.writeImageDataToTempFile(data.imageData, next);
			},
			function (path, next) {
				convertToPNG(path, extension, next);
			},
			function (path, next) {
				picture.path = path;
				var imageDimension = parseInt(meta.config.profileImageDimension, 10) || 200;
				image.resizeImage({
					path: picture.path,
					width: imageDimension,
					height: imageDimension,
				}, next);
			},
			function (next) {
				var filename = generateProfileImageFilename(data.uid, 'profileavatar', extension);
				uploadProfileOrCover(filename, picture, next);
			},
			function (_uploadedImage, next) {
				uploadedImage = _uploadedImage;

				User.setUserFields(data.uid, {
					uploadedpicture: uploadedImage.url,
					picture: uploadedImage.url,
				}, next);
			},
		], function (err) {
			file.delete(picture.path);
			callback(err, uploadedImage);
		});
	};

	function convertToPNG(path, extension, callback) {
		var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10) === 1;
		if (!convertToPNG) {
			return setImmediate(callback, null, path);
		}
		async.waterfall([
			function (next) {
				image.normalise(path, extension, next);
			},
			function (newPath, next) {
				file.delete(path);
				next(null, newPath);
			},
		], callback);
	}

	function uploadProfileOrCover(filename, image, callback) {
		if (plugins.hasListeners('filter:uploadImage')) {
			return plugins.fireHook('filter:uploadImage', {
				image: image,
				uid: image.uid,
			}, callback);
		}

		saveFileToLocal(filename, image, callback);
	}

	function generateProfileImageFilename(uid, type, extension) {
		var keepAllVersions = parseInt(meta.config['profile:keepAllUserImages'], 10) === 1;
		var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10) === 1;
		return uid + '-' + type + (keepAllVersions ? '-' + Date.now() : '') + (convertToPNG ? '.png' : extension);
	}

	function saveFileToLocal(filename, image, callback) {
		async.waterfall([
			function (next) {
				file.isFileTypeAllowed(image.path, next);
			},
			function (next) {
				file.saveFileToLocal(filename, 'profile', image.path, next);
			},
			function (upload, next) {
				next(null, {
					url: upload.url,
					path: upload.path,
					name: image.name,
				});
			},
		], callback);
	}

	User.removeCoverPicture = function (data, callback) {
		db.deleteObjectFields('user:' + data.uid, ['cover:url', 'cover:position'], callback);
	};
};
