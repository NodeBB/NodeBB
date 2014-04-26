"use strict";

var fs = require('fs'),
	path = require('path'),
	file = require('./../../file'),
	plugins = require('./../../plugins');


var uploadsController = {};

function validateUpload(res, req, allowedTypes) {
	if (allowedTypes.indexOf(req.files.userPhoto.type) === -1) {
		var err = {
			error: 'Invalid image type. Allowed types are: ' + allowedTypes.join(', ')
		};

		res.send(req.xhr ? err : JSON.stringify(err));
		return false;
	}

	return true;
}



uploadsController.uploadImage = function(filename, req, res) {
	function done(err, image) {
		var er, rs;
		fs.unlink(req.files.userPhoto.path);

		if(err) {
			er = {error: err.message};
			return res.send(req.xhr ? er : JSON.stringify(er));
		}

		rs = {path: image.url};
		res.send(req.xhr ? rs : JSON.stringify(rs));
	}

	if(plugins.hasListeners('filter:uploadImage')) {
		plugins.fireHook('filter:uploadImage', req.files.userPhoto, done);
	} else {
		file.saveFileToLocal(filename, req.files.userPhoto.path, done);
	}
};

uploadsController.uploadCategoryPicture = function(req, res, next) {
	var allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml'],
		params = null;

	try {
		params = JSON.parse(req.body.params);
	} catch (e) {
		var err = {
			error: 'Error uploading file! Error :' + e.message
		};
		return res.send(req.xhr ? err : JSON.stringify(err));
	}

	if (validateUpload(res, req, allowedTypes)) {
		var filename =  'category-' + params.cid + path.extname(req.files.userPhoto.name);
		uploadsController.uploadImage(filename, req, res);
	}
};

uploadsController.uploadFavicon = function(req, res, next) {
	var allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'];

	if (validateUpload(res, req, allowedTypes)) {
		file.saveFileToLocal('favicon.ico', req.files.userPhoto.path, function(err, image) {
			fs.unlink(req.files.userPhoto.path);

			if(err) {
				return res.send(req.xhr ? err : JSON.stringify(err));
			}

			var rs = {path: image.url};
			res.send(req.xhr ? rs : JSON.stringify(rs));
		});
	}
};

uploadsController.uploadLogo = function(req, res, next) {
	var allowedTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif'],
		er;

	if (validateUpload(res, req, allowedTypes)) {
		var filename = 'site-logo' + path.extname(req.files.userPhoto.name);
		uploadsController.uploadImage(filename, req, res);
	}
};


uploadsController.uploadGravatarDefault = function(req, res, next) {
	var allowedTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif'],
		er;

	if (validateUpload(res, req, allowedTypes)) {
		var filename = 'gravatar-default' + path.extname(req.files.userPhoto.name);
		uploadsController.uploadImage(filename, req, res);
	}
};



module.exports = uploadsController;
