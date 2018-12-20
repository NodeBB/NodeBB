'use strict';

var path = require('path');
var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var db = require('../database');
var meta = require('../meta');
var file = require('../file');
var plugins = require('../plugins');
var image = require('../image');
var privileges = require('../privileges');

var uploadsController = module.exports;

uploadsController.upload = function (req, res, filesIterator) {
	var files = req.files.files;

	if (!Array.isArray(files)) {
		return res.status(500).json('invalid files');
	}

	if (Array.isArray(files[0])) {
		files = files[0];
	}

	async.mapSeries(files, filesIterator, function (err, images) {
		deleteTempFiles(files);

		if (err) {
			return res.status(500).json({ path: req.path, error: err.message });
		}

		res.status(200).json(images);
	});
};

uploadsController.uploadPost = function (req, res, next) {
	uploadsController.upload(req, res, function (uploadedFile, next) {
		var isImage = uploadedFile.type.match(/image./);
		if (isImage) {
			uploadAsImage(req, uploadedFile, next);
		} else {
			uploadAsFile(req, uploadedFile, next);
		}
	}, next);
};

function uploadAsImage(req, uploadedFile, callback) {
	async.waterfall([
		function (next) {
			privileges.global.can('upload:post:image', req.uid, next);
		},
		function (canUpload, next) {
			if (!canUpload) {
				return next(new Error('[[error:no-privileges]]'));
			}
			image.checkDimensions(uploadedFile.path, next);
		},
		function (next) {
			if (plugins.hasListeners('filter:uploadImage')) {
				return plugins.fireHook('filter:uploadImage', {
					image: uploadedFile,
					uid: req.uid,
				}, callback);
			}
			file.isFileTypeAllowed(uploadedFile.path, next);
		},
		function (next) {
			uploadsController.uploadFile(req.uid, uploadedFile, next);
		},
		function (fileObj, next) {
			if (meta.config.resizeImageWidth === 0 || meta.config.resizeImageWidthThreshold === 0) {
				return next(null, fileObj);
			}

			resizeImage(fileObj, next);
		},
		function (fileObj, next) {
			next(null, { url: fileObj.url });
		},
	], callback);
}

function uploadAsFile(req, uploadedFile, callback) {
	async.waterfall([
		function (next) {
			privileges.global.can('upload:post:file', req.uid, next);
		},
		function (canUpload, next) {
			if (!canUpload) {
				return next(new Error('[[error:no-privileges]]'));
			}
			if (!meta.config.allowFileUploads) {
				return next(new Error('[[error:uploads-are-disabled]]'));
			}
			uploadsController.uploadFile(req.uid, uploadedFile, next);
		},
		function (fileObj, next) {
			next(null, {
				url: fileObj.url,
				name: fileObj.name,
			});
		},
	], callback);
}

function resizeImage(fileObj, callback) {
	async.waterfall([
		function (next) {
			image.size(fileObj.path, next);
		},
		function (imageData, next) {
			if (imageData.width < meta.config.resizeImageWidthThreshold || meta.config.resizeImageWidth > meta.config.resizeImageWidthThreshold) {
				return callback(null, fileObj);
			}

			image.resizeImage({
				path: fileObj.path,
				target: file.appendToFileName(fileObj.path, '-resized'),
				width: meta.config.resizeImageWidth,
				quality: meta.config.resizeImageQuality,
			}, next);
		},
		function (next) {
			// Return the resized version to the composer/postData
			fileObj.url = file.appendToFileName(fileObj.url, '-resized');

			next(null, fileObj);
		},
	], callback);
}

uploadsController.uploadThumb = function (req, res, next) {
	if (!meta.config.allowTopicsThumbnail) {
		deleteTempFiles(req.files.files);
		return next(new Error('[[error:topic-thumbnails-are-disabled]]'));
	}

	uploadsController.upload(req, res, function (uploadedFile, next) {
		async.waterfall([
			function (next) {
				if (!uploadedFile.type.match(/image./)) {
					return next(new Error('[[error:invalid-file]]'));
				}

				file.isFileTypeAllowed(uploadedFile.path, next);
			},
			function (next) {
				image.resizeImage({
					path: uploadedFile.path,
					width: meta.config.topicThumbSize,
					height: meta.config.topicThumbSize,
				}, next);
			},
			function (next) {
				if (plugins.hasListeners('filter:uploadImage')) {
					return plugins.fireHook('filter:uploadImage', {
						image: uploadedFile,
						uid: req.uid,
					}, next);
				}

				uploadsController.uploadFile(req.uid, uploadedFile, next);
			},
		], next);
	}, next);
};

uploadsController.uploadFile = function (uid, uploadedFile, callback) {
	if (plugins.hasListeners('filter:uploadFile')) {
		return plugins.fireHook('filter:uploadFile', {
			file: uploadedFile,
			uid: uid,
		}, callback);
	}

	if (!uploadedFile) {
		return callback(new Error('[[error:invalid-file]]'));
	}

	if (uploadedFile.size > meta.config.maximumFileSize * 1024) {
		return callback(new Error('[[error:file-too-big, ' + meta.config.maximumFileSize + ']]'));
	}

	var allowed = file.allowedExtensions();

	var extension = path.extname(uploadedFile.name).toLowerCase();
	if (allowed.length > 0 && (!extension || extension === '.' || !allowed.includes(extension))) {
		return callback(new Error('[[error:invalid-file-type, ' + allowed.join('&#44; ') + ']]'));
	}

	saveFileToLocal(uid, uploadedFile, callback);
};

function saveFileToLocal(uid, uploadedFile, callback) {
	var filename = uploadedFile.name || 'upload';
	var extension = path.extname(filename) || '';

	filename = Date.now() + '-' + validator.escape(filename.substr(0, filename.length - extension.length)).substr(0, 255) + extension;
	var storedFile;
	async.waterfall([
		function (next) {
			file.saveFileToLocal(filename, 'files', uploadedFile.path, next);
		},
		function (upload, next) {
			storedFile = {
				url: nconf.get('relative_path') + upload.url,
				path: upload.path,
				name: uploadedFile.name,
			};

			var fileKey = upload.url.replace(nconf.get('upload_url'), '');
			db.sortedSetAdd('uid:' + uid + ':uploads', Date.now(), fileKey, next);
		},
		function (next) {
			plugins.fireHook('filter:uploadStored', { uid: uid, uploadedFile: uploadedFile, storedFile: storedFile }, next);
		},
		function (data, next) {
			next(null, data.storedFile);
		},
	], callback);
}

function deleteTempFiles(files) {
	async.each(files, function (fileObj, next) {
		file.delete(fileObj.path);
		next();
	});
}
