"use strict";

var fs = require('fs'),
	path = require('path'),
	async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),
	file = require('../../file'),
	image = require('../../image'),
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

uploadsController.uploadTouchIcon = function(req, res, next) {
	var uploadedFile = req.files.files[0],
		allowedTypes = ['image/png'],
		sizes = [36, 48, 72, 96, 144, 192];

	if (validateUpload(req, res, next, uploadedFile, allowedTypes)) {
		file.saveFileToLocal('touchicon-orig.png', 'system', uploadedFile.path, function(err, imageObj) {
			// Resize the image into squares for use as touch icons at various DPIs
			async.each(sizes, function(size, next) {
				async.series([
					async.apply(file.saveFileToLocal, 'touchicon-' + size + '.png', 'system', uploadedFile.path),
					async.apply(image.resizeImage, {
						path: path.join(nconf.get('base_dir'), nconf.get('upload_path'), 'system', 'touchicon-' + size + '.png'),
						extension: 'png',
						width: size,
						height: size
					})
				], next);
			}, function(err) {
				fs.unlink(uploadedFile.path, function(err) {
					if (err) {
						winston.error(err);
					}
				});

				if (err) {
					return next(err);
				}

				res.json([{name: uploadedFile.name, url: imageObj.url}]);
			});
		});
	}
};

uploadsController.uploadLogo = function(req, res, next) {
	upload('site-logo', req, res, next);
};

uploadsController.uploadSound = function(req, res, next) {
	var uploadedFile = req.files.files[0];

	file.saveFileToLocal(uploadedFile.name, 'sounds', uploadedFile.path, function(err) {
		if (err) {
			return next(err);
		}

		var	soundsPath = path.join(__dirname, '../../../public/sounds'),
			filePath = path.join(__dirname, '../../../public/uploads/sounds', uploadedFile.name);

		if (process.platform === 'win32') {
			fs.link(filePath, path.join(soundsPath, path.basename(filePath)));
		} else {
			fs.symlink(filePath, path.join(soundsPath, path.basename(filePath)), 'file');
		}

		fs.unlink(uploadedFile.path, function(err) {
			if (err) {
				return next(err);
			}

			res.json([{}]);
		});
	});
};

uploadsController.uploadDefaultAvatar = function(req, res, next) {
	upload('avatar-default', req, res, next);
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

		res.json({error: '[[error:invalid-image-type, ' + allowedTypes.join('&#44; ') + ']]'});
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
