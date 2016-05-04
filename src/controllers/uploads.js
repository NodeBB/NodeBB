"use strict";

var fs = require('fs');
var path = require('path');
var async = require('async');
var nconf = require('nconf');
var validator = require('validator');
var winston = require('winston');
var mime = require('mime');

var meta = require('../meta');
var file = require('../file');
var plugins = require('../plugins');
var image = require('../image');

var uploadsController = {};

uploadsController.upload = function(req, res, filesIterator) {
	var files = req.files.files;

	if (!req.user && meta.config.allowGuestUploads !== '1') {
		deleteTempFiles(files);
		return res.status(403).json('[[error:guest-upload-disabled]]');
	}

	if (!Array.isArray(files)) {
		return res.status(500).json('invalid files');
	}

	if (Array.isArray(files[0])) {
		files = files[0];
	}

	async.map(files, filesIterator, function(err, images) {
		deleteTempFiles(files);

		if (err) {
			return res.status(500).send(err.message);
		}

		// IE8 - send it as text/html so browser won't trigger a file download for the json response
		// malsup.com/jquery/form/#file-upload
		res.status(200).send(req.xhr ? images : JSON.stringify(images));
	});
};

uploadsController.uploadPost = function(req, res, next) {
	uploadsController.upload(req, res, function(uploadedFile, next) {
		var isImage = uploadedFile.type.match(/image./);
		if (isImage && plugins.hasListeners('filter:uploadImage')) {
			return plugins.fireHook('filter:uploadImage', {image: uploadedFile, uid: req.uid}, next);
		}

		async.waterfall([
			function(next) {
				if (isImage) {
					file.isFileTypeAllowed(uploadedFile.path, next);
				} else {
					next();
				}
			},
			function (next) {
				if (parseInt(meta.config.allowFileUploads, 10) !== 1) {
					return next(new Error('[[error:uploads-are-disabled]]'));
				}
				uploadFile(req.uid, uploadedFile, next);
			},
			function(fileObj, next) {
				if (!isImage || parseInt(meta.config.maximumImageWidth, 10) === 0) {
					// Not an image, or resizing disabled. No need to resize.
					return next(null, fileObj);
				}

				resizeImage(fileObj, next);
			}
		], next);
	}, next);
};

function resizeImage(fileObj, callback) {
	var fullPath;
	async.waterfall([
		function(next) {
			fullPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), '..', fileObj.url);

			image.load(fullPath, next);
		},
		function (imageData, next) {
			if (imageData.width < parseInt(meta.config.maximumImageWidth, 10) || 760) {
				return callback(null, fileObj);
			}

			var dirname = path.dirname(fullPath);
			var extname = path.extname(fullPath);
			var basename = path.basename(fullPath, extname);

			image.resizeImage({
				path: fullPath,
				target: path.join(dirname, basename + '-resized' + extname),
				extension: extname,
				width: parseInt(meta.config.maximumImageWidth, 10) || 760
			}, next);
		},
		function (next) {

			// Return the resized version to the composer/postData
			var dirname = path.dirname(fileObj.url);
			var extname = path.extname(fileObj.url);
			var basename = path.basename(fileObj.url, extname);

			fileObj.url = path.join(dirname, basename + '-resized' + extname);

			next(null, fileObj);
		}
	], callback);
}

uploadsController.uploadThumb = function(req, res, next) {
	if (parseInt(meta.config.allowTopicsThumbnail, 10) !== 1) {
		deleteTempFiles(req.files.files);
		return next(new Error('[[error:topic-thumbnails-are-disabled]]'));
	}

	uploadsController.upload(req, res, function(uploadedFile, next) {
		file.isFileTypeAllowed(uploadedFile.path, function(err) {
			if (err) {
				return next(err);
			}

			if (!uploadedFile.type.match(/image./)) {
				return next(new Error('[[error:invalid-file]]'));
			}

			var size = parseInt(meta.config.topicThumbSize, 10) || 120;
			image.resizeImage({
				path: uploadedFile.path,
				extension: path.extname(uploadedFile.name),
				width: size,
				height: size
			}, function(err) {
				if (err) {
					return next(err);
				}

				if (plugins.hasListeners('filter:uploadImage')) {
					return plugins.fireHook('filter:uploadImage', {image: uploadedFile, uid: req.uid}, next);
				}

				uploadFile(req.uid, uploadedFile, next);
			});
		});
	}, next);
};

uploadsController.uploadGroupCover = function(uid, uploadedFile, callback) {
	if (plugins.hasListeners('filter:uploadImage')) {
		return plugins.fireHook('filter:uploadImage', {image: uploadedFile, uid: uid}, callback);
	}

	if (plugins.hasListeners('filter:uploadFile')) {
		return plugins.fireHook('filter:uploadFile', {file: uploadedFile, uid: uid}, callback);
	}

	file.isFileTypeAllowed(uploadedFile.path, function(err) {
		if (err) {
			return callback(err);
		}
		saveFileToLocal(uploadedFile, callback);
	});
};

function uploadFile(uid, uploadedFile, callback) {
	if (plugins.hasListeners('filter:uploadFile')) {
		return plugins.fireHook('filter:uploadFile', {file: uploadedFile, uid: uid}, callback);
	}

	if (!uploadedFile) {
		return callback(new Error('[[error:invalid-file]]'));
	}

	if (uploadedFile.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		return callback(new Error('[[error:file-too-big, ' + meta.config.maximumFileSize + ']]'));
	}

	if (meta.config.hasOwnProperty('allowedFileExtensions')) {
		var allowed = file.allowedExtensions();
		var extension = path.extname(uploadedFile.name);
		if (!extension) {
			extension = '.' + mime.extension(uploadedFile.type);
		}
		if (allowed.length > 0 && allowed.indexOf(extension) === -1) {
			return callback(new Error('[[error:invalid-file-type, ' + allowed.join('&#44; ') + ']]'));
		}
	}

	saveFileToLocal(uploadedFile, callback);
}

function saveFileToLocal(uploadedFile, callback) {
	var extension = path.extname(uploadedFile.name);
	if (!extension) {
		extension = '.' + mime.extension(uploadedFile.type);
	}

	var filename = uploadedFile.name || 'upload';

	filename = Date.now() + '-' + validator.escape(filename.replace(extension, '')).substr(0, 255) + extension;
	file.saveFileToLocal(filename, 'files', uploadedFile.path, function(err, upload) {
		if (err) {
			return callback(err);
		}

		callback(null, {
			url: nconf.get('relative_path') + upload.url,
			name: uploadedFile.name
		});
	});
}

function deleteTempFiles(files) {
	async.each(files, function(file, next) {
		fs.unlink(file.path, function(err) {
			if (err) {
				winston.error(err);
			}
			next();
		});
	});
}



module.exports = uploadsController;
