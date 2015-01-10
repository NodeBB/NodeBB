"use strict";

var fs = require('fs'),
	path = require('path'),
	file = require('../../file'),
	plugins = require('../../plugins');


var uploadsController = {};

uploadsController.uploadCategoryPicture = function(req, res, next) {
	var uploadedFile = req.files.files[0];
	var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml'],
		params = null;

	try {
		params = JSON.parse(req.body.params);
	} catch (e) {
		var err = {
			error: 'Error uploading file! Error :' + e.message
		};
		fs.unlink(uploadedFile.path);
		return res.send(req.xhr ? err : JSON.stringify(err));
	}

	if (validateUpload(req, res, uploadedFile, allowedTypes)) {
		var filename =  'category-' + params.cid + path.extname(uploadedFile.name);
		uploadImage(filename, 'category', uploadedFile, req, res);
	}
};

uploadsController.uploadFavicon = function(req, res, next) {
	var uploadedFile = req.files.files[0];
	var allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'];

	if (validateUpload(res, req, uploadedFile, allowedTypes)) {
		file.saveFileToLocal('favicon.ico', 'files', uploadedFile.path, function(err, image) {
			fs.unlink(uploadedFile.path);

			var response = err ? {error: err.message} : {path: image.url};

			res.send(req.xhr ? response : JSON.stringify(response));
		});
	}
};

uploadsController.uploadLogo = function(req, res, next) {
	upload('site-logo', req, res, next);
};

uploadsController.uploadGravatarDefault = function(req, res, next) {
	upload('gravatar-default', req, res, next);
};

function upload(name, req, res, next) {
	var uploadedFile = req.files.files[0];
	var allowedTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif'];
	if (validateUpload(req, res, uploadedFile, allowedTypes)) {
		var filename = name + path.extname(uploadedFile.name);
		uploadImage(filename, 'files', uploadedFile, req, res);
	}
}

function validateUpload(req, res, uploadedFile, allowedTypes) {
	if (allowedTypes.indexOf(uploadedFile.type) === -1) {
		var err = {
			error: 'Invalid image type. Allowed types are: ' + allowedTypes.join(', ')
		};

		fs.unlink(uploadedFile.path);
		res.send(req.xhr ? err : JSON.stringify(err));
		return false;
	}

	return true;
}

function uploadImage(filename, folder, uploadedFile, req, res) {
	function done(err, uploadedImage) {
		fs.unlink(uploadedFile.path);

		var response = err ? {error: err.message} : {path: uploadedImage.url};

		res.send(req.xhr ? response : JSON.stringify(response));
	}

	if (plugins.hasListeners('filter:uploadImage')) {
		plugins.fireHook('filter:uploadImage', {image: uploadedFile, uid: req.user.uid}, done);
	} else {
		file.saveFileToLocal(filename, folder, uploadedFile.path, done);
	}
}

module.exports = uploadsController;
