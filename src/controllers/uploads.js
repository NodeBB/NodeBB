"use strict";

var uploadsController = {},

	fs = require('fs'),
	path = require('path'),
	async = require('async'),

	meta = require('../meta'),
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
	uploadsController.upload(req, res, function(file, next) {
		if (file.type.match(/image./)) {
			uploadImage(req.user.uid, file, next);
		} else {
			uploadFile(req.user.uid, file, next);
		}
	}, next);
};

uploadsController.uploadThumb = function(req, res, next) {
	if (parseInt(meta.config.allowTopicsThumbnail, 10) !== 1) {
		deleteTempFiles(req.files.files);
		return next(new Error('[[error:topic-thumbnails-are-disabled]]'));
	}

	uploadsController.upload(req, res, function(file, next) {
		if(file.type.match(/image./)) {
			var size = meta.config.topicThumbSize || 120;
			image.resizeImage(file.path, path.extname(file.name), size, size, function(err) {
				if (err) {
					return next(err);
				}
				uploadImage(req.user.uid, file, next);
			});
		} else {
			next(new Error('[[error:invalid-file]]'));
		}
	}, next);
};

uploadsController.uploadGroupCover = function(data, next) {
	uploadImage(0/*req.user.uid*/, data, next);
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

function uploadFile(uid, file, callback) {
	if (plugins.hasListeners('filter:uploadFile')) {
		return plugins.fireHook('filter:uploadFile', {file: file, uid: uid}, callback);
	}

	if (parseInt(meta.config.allowFileUploads, 10) !== 1) {
		return callback(new Error('[[error:uploads-are-disabled]]'));
	}

	if (!file) {
		return callback(new Error('[[error:invalid-file]]'));
	}

	if (file.size > parseInt(meta.config.maximumFileSize, 10) * 1024) {
		return callback(new Error('[[error:file-too-big, ' + meta.config.maximumFileSize + ']]'));
	}

	var filename = 'upload-' + utils.generateUUID() + path.extname(file.name);
	require('../file').saveFileToLocal(filename, 'files', file.path, function(err, upload) {
		if (err) {
			return callback(err);
		}

		callback(null, {
			url: upload.url,
			name: file.name
		});
	});
}

function deleteTempFiles(files) {
	for(var i=0; i<files.length; ++i) {
		fs.unlink(files[i].path);
	}
}



module.exports = uploadsController;
