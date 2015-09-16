"use strict";

var fs = require('fs'),
	path = require('path'),
	nconf = require('nconf'),
	winston = require('winston'),
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
		fs.unlink(uploadedFile.path, function(err) {
			if (err) {
				winston.error(err);
			}
		});
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

	if (validateUpload(req, res, next, uploadedFile, allowedTypes)) {
		file.saveFileToLocal('favicon.ico', 'system', uploadedFile.path, function(err, image) {
			fs.unlink(uploadedFile.path, function(err) {
				if (err) {
					winston.error(err);
				}
			});
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
		uploadImage(filename, 'system', uploadedFile, req, res, next);
	}
}

function validateUpload(req, res, next, uploadedFile, allowedTypes) {
	if (allowedTypes.indexOf(uploadedFile.type) === -1) {
		fs.unlink(uploadedFile.path, function(err) {
			if (err) {
				winston.error(err);
			}
		});

		res.json({error: '[[error:invalid-image-type, ' + allowedTypes.join(', ') + ']]'});
		return false;
	}

	return true;
}

function uploadImage(filename, folder, uploadedFile, req, res, next) {
	function done(err, image) {
		fs.unlink(uploadedFile.path, function(err) {
			if (err) {
				winston.error(err);
			}
		});
		if (err) {
			return next(err);
		}
		res.json([{name: uploadedFile.name, url: image.url.startsWith('http') ? image.url : nconf.get('relative_path') + image.url}]);
	}

	if (plugins.hasListeners('filter:uploadImage')) {
		plugins.fireHook('filter:uploadImage', {image: uploadedFile, uid: req.user.uid}, done);
	} else {
		file.saveFileToLocal(filename, folder, uploadedFile.path, done);
	}
}

module.exports = uploadsController;
