'use strict';

var async = require('async'),
	path = require('path'),
	fs = require('fs'),
	os = require('os'),
	nconf = require('nconf'),
	crypto = require('crypto'),
	winston = require('winston'),
	request = require('request'),
	mime = require('mime'),

	plugins = require('../plugins'),
	file = require('../file'),
	image = require('../image'),
	meta = require('../meta'),
	db = require('../database');

module.exports = function(User) {

	User.uploadPicture = function (uid, picture, callback) {

		var uploadSize = parseInt(meta.config.maximumProfileImageSize, 10) || 256;
		var extension = path.extname(picture.name);
		var updateUid = uid;
		var imageDimension = parseInt(meta.config.profileImageDimension, 10) || 128;
		var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10) === 1;
		var uploadedImage;

		async.waterfall([
			function(next) {
				next(parseInt(meta.config.allowProfileImageUploads) !== 1 ? new Error('[[error:profile-image-uploads-disabled]]') : null);
			},
			function(next) {
				next(picture.size > uploadSize * 1024 ? new Error('[[error:file-too-big, ' + uploadSize + ']]') : null);
			},
			function(next) {
				next(!extension ? new Error('[[error:invalid-image-extension]]') : null);
			},
			function(next) {
				if (plugins.hasListeners('filter:uploadImage')) {
					return plugins.fireHook('filter:uploadImage', {image: picture, uid: updateUid}, next);
				}

				var filename = updateUid + '-profileimg' + (convertToPNG ? '.png' : extension);

				async.waterfall([
					function(next) {
						file.isFileTypeAllowed(picture.path, next);
					},
					function(next) {
						image.resizeImage({
							path: picture.path,
							extension: extension,
							width: imageDimension,
							height: imageDimension
						}, next);
					},
					function(next) {
						if (!convertToPNG) {
							return next();
						}
						async.series([
							async.apply(image.normalise, picture.path, extension),
							async.apply(fs.rename, picture.path + '.png', picture.path)
						], next);
					},
					function(next) {
						User.getUserField(updateUid, 'uploadedpicture', next);
					},
					function(oldpicture, next) {
						if (!oldpicture) {
							return file.saveFileToLocal(filename, 'profile', picture.path, next);
						}
						var oldpicturePath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), 'profile', path.basename(oldpicture));

						fs.unlink(oldpicturePath, function (err) {
							if (err) {
								winston.error(err);
							}

							file.saveFileToLocal(filename, 'profile', picture.path, next);
						});
					},
				], next);
			},
			function(_image, next) {
				uploadedImage = _image;
				User.setUserFields(updateUid, {uploadedpicture: uploadedImage.url, picture: uploadedImage.url}, next);
			},
			function(next) {
				next(null, uploadedImage);
			}
		], callback);
	};

	User.uploadFromUrl = function(uid, url, callback) {
		if (!plugins.hasListeners('filter:uploadImage')) {
			return callback(new Error('[[error:no-plugin]]'));
		}

		request.head(url, function(err, res) {
			if (err) {
				return callback(err);
			}
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

			var picture = {url: url, name: ''};
			plugins.fireHook('filter:uploadImage', {image: picture, uid: uid}, function(err, image) {
				if (err) {
					return callback(err);
				}
				User.setUserFields(uid, {uploadedpicture: image.url, picture: image.url});
				callback(null, image);
			});
		});
	};

	User.updateCoverPosition = function(uid, position, callback) {
		User.setUserField(uid, 'cover:position', position, callback);
	};

	User.updateCoverPicture = function(data, callback) {
		var url, md5sum;

		if (!data.imageData && data.position) {
			return User.updateCoverPosition(data.uid, data.position, callback);
		}

		if (!data.imageData && !data.file) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function(next) {
				var size = data.file ? data.file.size : data.imageData.length;
				meta.config.maximumCoverImageSize = meta.config.maximumCoverImageSize || 2048;
				if (size > parseInt(meta.config.maximumCoverImageSize, 10) * 1024) {
					return next(new Error('[[error:file-too-big, ' + meta.config.maximumCoverImageSize + ']]'));
				}

				if (data.file) {
					return next();
				}

				md5sum = crypto.createHash('md5');
				md5sum.update(data.imageData);
				md5sum = md5sum.digest('hex');

				data.file = {
					path: path.join(os.tmpdir(), md5sum)
				};

				var buffer = new Buffer(data.imageData.slice(data.imageData.indexOf('base64') + 7), 'base64');

				fs.writeFile(data.file.path, buffer, {
					encoding: 'base64'
				}, next);
			},
			function(next) {
				var image = {
					name: 'profileCover',
					path: data.file.path,
					uid: data.uid
				};

				if (plugins.hasListeners('filter:uploadImage')) {
					return plugins.fireHook('filter:uploadImage', {image: image, uid: data.uid}, next);
				}

				var filename = data.uid + '-profilecover';
				async.waterfall([
					function (next) {
						file.isFileTypeAllowed(data.file.path, next);
					},
					function (next) {
						file.saveFileToLocal(filename, 'profile', image.path, next);
					},
					function (upload, next) {
						next(null, {
							url: nconf.get('relative_path') + upload.url,
							name: image.name
						});
					}
				], next);
			},
			function(uploadData, next) {
				url = uploadData.url;
				User.setUserField(data.uid, 'cover:url', uploadData.url, next);
			},
			function(next) {
				fs.unlink(data.file.path, function(err) {
					if (err) {
						winston.error(err);
					}
					next();
				});
			}
		], function(err) {
			if (err) {
				return fs.unlink(data.file.path, function(unlinkErr) {
					callback(err);	// send back the original error
				});
			}

			if (data.position) {
				User.updateCoverPosition(data.uid, data.position, function(err) {
					callback(err, {url: url});
				});
			} else {
				callback(err, {url: url});
			}
		});
	};

	User.removeCoverPicture = function(data, callback) {
		db.deleteObjectField('user:' + data.uid, 'cover:url', callback);
	};
};
