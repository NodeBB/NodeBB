"use strict";

var uploadsController = {},

	fs = require('fs'),
	path = require('path'),
	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),

	meta = require('../meta'),
	file = require('../file'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	image = require('../image');


uploadsController.upload = function(req, res, filesIterator, next) {
	var files = req.files.files;

	if (!req.user) {
		deleteTempFiles(files);
		return res.status(403).json('not allowed');
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
		if (uploadedFile.type.match(/image./)) {
			file.isFileTypeAllowed(uploadedFile.path, function(err) {
				if (err) {
					return next(err);
				}

				uploadImage(req.user.uid, uploadedFile, next);
			});
		} else {
			uploadFile(req.user.uid, uploadedFile, next);
		}
	}, next);
};

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

			if (uploadedFile.type.match(/image./)) {
				var size = meta.config.topicThumbSize || 120;
				image.resizeImage({
					path: uploadedFile.path,
					extension: path.extname(uploadedFile.name),
					width: size,
					height: size
				}, function(err) {
					if (err) {
						return next(err);
					}
					uploadImage(req.user.uid, uploadedFile, next);
				});
			} else {
				next(new Error('[[error:invalid-file]]'));
			}
		});
	}, next);
};

uploadsController.uploadGroupCover = function(data, next) {
	uploadImage(0, data, next);
};

function uploadImage(uid, image, callback) {
	if (plugins.hasListeners('filter:uploadImage')) {
		return plugins.fireHook('filter:uploadImage', {image: image, uid: uid}, callback);
	}

	if (parseInt(meta.config.allowFileUploads, 10)) {
		uploadFile(uid, image, callback);
	} else {
		callback(new Error('[[error:uploads-are-disabled]]'));
	}
}

function uploadFile(uid, uploadedFile, callback) {
	if (plugins.hasListeners('filter:uploadFile')) {
		return plugins.fireHook('filter:uploadFile', {file: uploadedFile, uid: uid}, callback);
	}

	if (parseInt(meta.config.allowFileUploads, 10) !== 1) {
		return callback(new Error('[[error:uploads-are-disabled]]'));
	}

	if (!uploadedFile) {
		return callback(new Error('[[error:invalid-file]]'));
	}

	if (uploadedFile.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		return callback(new Error('[[error:file-too-big, ' + meta.config.maximumFileSize + ']]'));
	}

	var filename = uploadedFile.name || 'upload';

	filename = Date.now() + '-' + validator.escape(filename).substr(0, 255);
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
