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
var privileges = require('../privileges');

var uploadsController = {};

uploadsController.upload = function (req, res, filesIterator) {
	var files = req.files.files;

	if (!Array.isArray(files)) {
		return res.status(500).json('invalid files');
	}

	if (Array.isArray(files[0])) {
		files = files[0];
	}

	async.map(files, filesIterator, function (err, images) {
		deleteTempFiles(files);

		if (err) {
			return res.status(500).send(err.message);
		}

		res.status(200).send(images);
	});
};

uploadsController.uploadPost = function (req, res, next) {
	uploadsController.upload(req, res, function (uploadedFile, next) {
		var isImage = uploadedFile.type.match(/image./);
		if (isImage) {
			uploadAsImage(req, uploadedFile, next);
		}
		else {
			uploadAsFile(req, uploadedFile, next);
		}
	}, next);
};

function uploadAsImage(req, uploadedFile, callback) {
	async.waterfall([
		function (next) {
			privileges.categories.can('upload:post:image', req.body.cid, req.uid, next);
		},
		function (canUpload, next) {
			if (!canUpload) {
				return next(new Error('[[error:no-privileges]]'));
			}
			if (plugins.hasListeners('filter:uploadImage')) {
				return plugins.fireHook('filter:uploadImage', {
					image: uploadedFile,
					uid: req.uid
				}, callback);
			}
			file.isFileTypeAllowed(uploadedFile.path, next);
		},
		function (next) {
			uploadFile(req.uid, uploadedFile, next);
		},
		function (fileObj, next) {
			if (parseInt(meta.config.maximumImageWidth, 10) === 0) {
				return next(null, fileObj);
			}

			resizeImage(fileObj, next);
		}
	], callback);
}

function uploadAsFile(req, uploadedFile, callback) {
	async.waterfall([
		function (next) {
			privileges.categories.can('upload:post:file', req.body.cid, req.uid, next);
		},
		function (canUpload, next) {
			if (!canUpload) {
				return next(new Error('[[error:no-privileges]]'));
			}
			if (parseInt(meta.config.allowFileUploads, 10) !== 1) {
				return next(new Error('[[error:uploads-are-disabled]]'));
			}
			uploadFile(req.uid, uploadedFile, next);
		}
	], callback);
}

function resizeImage(fileObj, callback) {
	async.waterfall([
		function (next) {
			image.size(fileObj.path, next);
		},
		function (imageData, next) {
			if (imageData.width < (parseInt(meta.config.maximumImageWidth, 10) || 760)) {
				return callback(null, fileObj);
			}

			var dirname = path.dirname(fileObj.path);
			var extname = path.extname(fileObj.path);
			var basename = path.basename(fileObj.path, extname);

			image.resizeImage({
				path: fileObj.path,
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

uploadsController.uploadThumb = function (req, res, next) {
	if (parseInt(meta.config.allowTopicsThumbnail, 10) !== 1) {
		deleteTempFiles(req.files.files);
		return next(new Error('[[error:topic-thumbnails-are-disabled]]'));
	}

	uploadsController.upload(req, res, function (uploadedFile, next) {
		file.isFileTypeAllowed(uploadedFile.path, function (err) {
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
			}, function (err) {
				if (err) {
					return next(err);
				}

				if (plugins.hasListeners('filter:uploadImage')) {
					return plugins.fireHook('filter:uploadImage', {
						image: uploadedFile,
						uid: req.uid
					}, next);
				}

				uploadFile(req.uid, uploadedFile, next);
			});
		});
	}, next);
};

uploadsController.uploadGroupCover = function (uid, uploadedFile, callback) {
	if (plugins.hasListeners('filter:uploadImage')) {
		return plugins.fireHook('filter:uploadImage', {
			image: uploadedFile,
			uid: uid
		}, callback);
	}

	if (plugins.hasListeners('filter:uploadFile')) {
		return plugins.fireHook('filter:uploadFile', {
			file: uploadedFile,
			uid: uid
		}, callback);
	}

	file.isFileTypeAllowed(uploadedFile.path, function (err) {
		if (err) {
			return callback(err);
		}
		saveFileToLocal(uploadedFile, callback);
	});
};

function uploadFile(uid, uploadedFile, callback) {
	if (plugins.hasListeners('filter:uploadFile')) {
		return plugins.fireHook('filter:uploadFile', {
			file: uploadedFile,
			uid: uid
		}, callback);
	}

	if (!uploadedFile) {
		return callback(new Error('[[error:invalid-file]]'));
	}

	if (uploadedFile.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		return callback(new Error('[[error:file-too-big, ' + meta.config.maximumFileSize + ']]'));
	}

	if (meta.config.hasOwnProperty('allowedFileExtensions')) {
		var allowed = file.allowedExtensions();
		var extension = file.typeToExtension(uploadedFile.type);
		if (!extension || (allowed.length > 0 && allowed.indexOf(extension) === -1)) {
			return callback(new Error('[[error:invalid-file-type, ' + allowed.join('&#44; ') + ']]'));
		}
	}

	saveFileToLocal(uploadedFile, callback);
}

function saveFileToLocal(uploadedFile, callback) {
	var extension = file.typeToExtension(uploadedFile.type);
	if (!extension) {
		return callback(new Error('[[error:invalid-extension]]'));
	}
	var filename = uploadedFile.name || 'upload';

	filename = Date.now() + '-' + validator.escape(filename.replace(path.extname(uploadedFile.name) || '', '')).substr(0, 255) + extension;

	file.saveFileToLocal(filename, 'files', uploadedFile.path, function (err, upload) {
		if (err) {
			return callback(err);
		}

		callback(null, {
			url: nconf.get('relative_path') + upload.url,
			path: upload.path,
			name: uploadedFile.name
		});
	});
}

function deleteTempFiles(files) {
	async.each(files, function (file, next) {
		fs.unlink(file.path, function (err) {
			if (err) {
				winston.error(err);
			}
			next();
		});
	});
}

module.exports = uploadsController;
