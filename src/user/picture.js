'use strict';

var async = require('async');
var path = require('path');
var fs = require('fs');
var os = require('os');
var nconf = require('nconf');
var crypto = require('crypto');
var winston = require('winston');
var request = require('request');
var mime = require('mime');

var plugins = require('../plugins');
var file = require('../file');
var image = require('../image');
var meta = require('../meta');
var db = require('../database');

module.exports = function (User) {
	User.uploadPicture = function (uid, picture, callback) {
		var uploadSize = parseInt(meta.config.maximumProfileImageSize, 10) || 256;
		var extension = path.extname(picture.name);
		var updateUid = uid;
		var imageDimension = parseInt(meta.config.profileImageDimension, 10) || 128;
		var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10) === 1;
		var keepAllVersions = parseInt(meta.config['profile:keepAllUserImages'], 10) === 1;
		var uploadedImage;

		if (parseInt(meta.config.allowProfileImageUploads, 10) !== 1) {
			return callback(new Error('[[error:profile-image-uploads-disabled]]'));
		}

		if (picture.size > uploadSize * 1024) {
			return callback(new Error('[[error:file-too-big, ' + uploadSize + ']]'));
		}

		if (!extension) {
			return callback(new Error('[[error:invalid-image-extension]]'));
		}

		async.waterfall([
			function (next) {
				if (plugins.hasListeners('filter:uploadImage')) {
					return plugins.fireHook('filter:uploadImage', {
						image: picture,
						uid: updateUid,
					}, next);
				}

				var filename = updateUid + '-profileimg' + (keepAllVersions ? '-' + Date.now() : '') + (convertToPNG ? '.png' : extension);

				async.waterfall([
					function (next) {
						file.isFileTypeAllowed(picture.path, next);
					},
					function (next) {
						image.resizeImage({
							path: picture.path,
							extension: extension,
							width: imageDimension,
							height: imageDimension,
							write: false,
						}, next);
					},
					function (next) {
						if (!convertToPNG) {
							return next();
						}
						async.series([
							async.apply(image.normalise, picture.path, extension),
							async.apply(fs.rename, picture.path + '.png', picture.path),
						], function (err) {
							next(err);
						});
					},
					function (next) {
						file.saveFileToLocal(filename, 'profile', picture.path, next);
					},
				], next);
			},
			function (_image, next) {
				uploadedImage = _image;
				User.setUserFields(updateUid, {
					uploadedpicture: uploadedImage.url,
					picture: uploadedImage.url,
				}, next);
			},
			function (next) {
				next(null, uploadedImage);
			},
		], callback);
	};

	User.uploadFromUrl = function (uid, url, callback) {
		if (!plugins.hasListeners('filter:uploadImage')) {
			return callback(new Error('[[error:no-plugin]]'));
		}

		async.waterfall([
			function (next) {
				request.head(url, next);
			},
			function (res, body, next) {
				var uploadSize = parseInt(meta.config.maximumProfileImageSize, 10) || 256;
				var size = res.headers['content-length'];
				var type = res.headers['content-type'];
				var extension = mime.extension(type);

				if (['png', 'jpeg', 'jpg', 'gif'].indexOf(extension) === -1) {
					return callback(new Error('[[error:invalid-image-extension]]'));
				}

				if (size > uploadSize * 1024) {
					return callback(new Error('[[error:file-too-big, ' + uploadSize + ']]'));
				}

				plugins.fireHook('filter:uploadImage', {
					uid: uid,
					image: {
						url: url,
						name: '',
					},
				}, next);
			},
			function (image, next) {
				User.setUserFields(uid, {
					uploadedpicture: image.url,
					picture: image.url,
				}, function (err) {
					next(err, image);
				});
			},
		], callback);
	};

	User.updateCoverPosition = function (uid, position, callback) {
		User.setUserField(uid, 'cover:position', position, callback);
	};

	User.updateCoverPicture = function (data, callback) {
		var url;
		var image = {
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
				var size = data.file ? data.file.size : data.imageData.length;
				meta.config.maximumCoverImageSize = meta.config.maximumCoverImageSize || 2048;
				if (size > parseInt(meta.config.maximumCoverImageSize, 10) * 1024) {
					return next(new Error('[[error:file-too-big, ' + meta.config.maximumCoverImageSize + ']]'));
				}

				if (data.file) {
					return setImmediate(next, null, data.file.path);
				}

				saveImageDataToTempFile(data.imageData, next);
			},
			function (path, next) {
				image.path = path;

				uploadProfileOrCover('profilecover', image, data.imageData, next);
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
			deleteFile(image.path);
			callback(err, {
				url: url,
			});
		});
	};

	User.uploadCroppedPicture = function (data, callback) {
		var url;
		var image = {
			name: 'profileAvatar',
			uid: data.uid,
		};

		if (!data.imageData) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				var size = data.imageData.length;
				var uploadSize = parseInt(meta.config.maximumProfileImageSize, 10) || 256;
				if (size > uploadSize * 1024) {
					return next(new Error('[[error:file-too-big, ' + meta.config.maximumProfileImageSize + ']]'));
				}

				saveImageDataToTempFile(data.imageData, next);
			},
			function (path, next) {
				image.path = path;

				uploadProfileOrCover('profileavatar', image, data.imageData, next);
			},
			function (uploadData, next) {
				url = uploadData.url;
				User.setUserFields(data.uid, {
					uploadedpicture: url,
					picture: url,
				}, next);
			},
		], function (err) {
			deleteFile(image.path);
			callback(err, {
				url: url,
			});
		});
	};

	function saveImageDataToTempFile(imageData, callback) {
		var filename = crypto.createHash('md5').update(imageData).digest('hex');
		var filepath = path.join(os.tmpdir(), filename);

		var buffer = new Buffer(imageData.slice(imageData.indexOf('base64') + 7), 'base64');

		fs.writeFile(filepath, buffer, {
			encoding: 'base64',
		}, function (err) {
			callback(err, filepath);
		});
	}

	function uploadProfileOrCover(type, image, imageData, callback) {
		if (plugins.hasListeners('filter:uploadImage')) {
			return plugins.fireHook('filter:uploadImage', {
				image: image,
				uid: image.uid,
			}, callback);
		}
		var filename = generateProfileImageFilename(image.uid, type, imageData);
		saveFileToLocal(filename, image, callback);
	}

	function generateProfileImageFilename(uid, type, imageData) {
		var extension = file.typeToExtension(imageData.slice(5, imageData.indexOf('base64') - 1));
		var keepAllVersions = parseInt(meta.config['profile:keepAllUserImages'], 10) === 1;
		var filename = uid + '-' + type + (keepAllVersions ? '-' + Date.now() : '') + (extension || '');
		return filename;
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
					url: nconf.get('relative_path') + upload.url,
					name: image.name,
				});
			},
		], callback);
	}

	function deleteFile(path) {
		if (path) {
			fs.unlink(path, function (err) {
				if (err) {
					winston.error(err);
				}
			});
		}
	}

	User.removeCoverPicture = function (data, callback) {
		db.deleteObjectFields('user:' + data.uid, ['cover:url', 'cover:position'], callback);
	};
};
