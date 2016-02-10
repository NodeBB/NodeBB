'use strict';

var async = require('async'),
	path = require('path'),
	fs = require('fs'),
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
				file.isFileTypeAllowed(picture.path, next);
			},
			function(path, next) {
				image.resizeImage({
					path: picture.path,
					extension: extension,
					width: imageDimension,
					height: imageDimension
				}, next);
			},
			function(next) {
				if (convertToPNG) {
					image.normalise(picture.path, extension, next);
				} else {
					next();
				}
			}
		], function(err) {
			function done(err, image) {
				if (err) {
					return callback(err);
				}

				User.setUserFields(updateUid, {uploadedpicture: image.url, picture: image.url});

				callback(null, image);
			}

			if (err) {
				return callback(err);
			}

			if (plugins.hasListeners('filter:uploadImage')) {
				return plugins.fireHook('filter:uploadImage', {image: picture, uid: updateUid}, done);
			}

			var filename = updateUid + '-profileimg' + (convertToPNG ? '.png' : extension);

			User.getUserField(updateUid, 'uploadedpicture', function (err, oldpicture) {
				if (err) {
					return callback(err);
				}

				if (!oldpicture) {
					return file.saveFileToLocal(filename, 'profile', picture.path, done);
				}

				var absolutePath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), 'profile', path.basename(oldpicture));

				fs.unlink(absolutePath, function (err) {
					if (err) {
						winston.error(err);
					}

					file.saveFileToLocal(filename, 'profile', picture.path, done);
				});
			});
		});
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
		var tempPath, url, md5sum;

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

				tempPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), md5sum);
				var buffer = new Buffer(data.imageData.slice(data.imageData.indexOf('base64') + 7), 'base64');

				fs.writeFile(tempPath, buffer, {
					encoding: 'base64'
				}, next);
			},
			function(next) {
				file.isFileTypeAllowed(tempPath, next);
			},
			function(tempPath, next) {
				var image = {
					name: 'profileCover',
					path: data.file ? data.file.path : tempPath,
					uid: data.uid
				};

				if (plugins.hasListeners('filter:uploadImage')) {
					return plugins.fireHook('filter:uploadImage', {image: image, uid: data.uid}, next);
				}

				var filename = data.uid + '-profilecover';
				file.saveFileToLocal(filename, 'profile', image.path, function(err, upload) {
					if (err) {
						return next(err);
					}

					next(null, {
						url: nconf.get('relative_path') + upload.url,
						name: image.name
					});
				});
			},
			function(uploadData, next) {
				url = uploadData.url;
				User.setUserField(data.uid, 'cover:url', uploadData.url, next);
			},
			function(next) {
				require('fs').unlink(data.file ? data.file.path : tempPath, function(err) {
					if (err) {
						winston.error(err);
					}
					next();
				});
			}
		], function(err) {
			if (err) {
				return fs.unlink(tempPath, function(unlinkErr) {
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