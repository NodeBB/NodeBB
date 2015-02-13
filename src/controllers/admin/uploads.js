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
		fs.unlink(uploadedFile.path);
		return next(e);
	}

	if (validateUpload(req, res, next, uploadedFile, allowedTypes)) {
		var filename =  'category-' + params.cid + path.extname(uploadedFile.name);
		uploadImage(filename, 'category', uploadedFile, req, res, next);
	}
};

uploadsController.uploadFavicon = function(req, res, next) {
	var uploadedFile = req.files.files[0];
	var allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'];

	if (validateUpload(res, req, next, uploadedFile, allowedTypes)) {
		file.saveFileToLocal('favicon.ico', 'files', uploadedFile.path, function(err, image) {
			fs.unlink(uploadedFile.path);
			if (err) {
				return next(err);
			}

			res.json([{name: uploadedFile.name, url: image.url}]);
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
	if (validateUpload(req, res, next, uploadedFile, allowedTypes)) {
		var filename = name + path.extname(uploadedFile.name);
		uploadImage(filename, 'files', uploadedFile, req, res, next);
	}
}

function validateUpload(req, res, next, uploadedFile, allowedTypes) {
	if (allowedTypes.indexOf(uploadedFile.type) === -1) {
		fs.unlink(uploadedFile.path);

		next(new Error('[[error:invalid-image-type, ' + allowedTypes.join(', ') + ']]'));
		return false;
	}

	return true;
}

function uploadImage(filename, folder, uploadedFile, req, res, next) {
	function done(err, image) {
		fs.unlink(uploadedFile.path);
		if (err) {
			return next(err);
		}

		res.json([{name: uploadedFile.name, url: image.url}]);
	}

	if (plugins.hasListeners('filter:uploadImage')) {
		plugins.fireHook('filter:uploadImage', {image: uploadedFile, uid: req.user.uid}, done);
	} else {
		file.saveFileToLocal(filename, folder, uploadedFile.path, done);
	}
}

module.exports = uploadsController;
