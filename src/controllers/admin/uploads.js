'use strict';

var path = require('path');
var async = require('async');
var nconf = require('nconf');
var mime = require('mime');

var meta = require('../../meta');
var file = require('../../file');
var image = require('../../image');
var plugins = require('../../plugins');

var allowedImageTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif', 'image/svg+xml'];

var uploadsController = module.exports;

uploadsController.uploadCategoryPicture = function (req, res, next) {
	var uploadedFile = req.files.files[0];
	var params = null;

	try {
		params = JSON.parse(req.body.params);
	} catch (e) {
		file.delete(uploadedFile.path);
		return next(new Error('[[error:invalid-json]]'));
	}

	if (validateUpload(req, res, next, uploadedFile, allowedImageTypes)) {
		var filename = 'category-' + params.cid + path.extname(uploadedFile.name);
		uploadImage(filename, 'category', uploadedFile, req, res, next);
	}
};

uploadsController.uploadFavicon = function (req, res, next) {
	var uploadedFile = req.files.files[0];
	var allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon'];

	if (validateUpload(req, res, next, uploadedFile, allowedTypes)) {
		file.saveFileToLocal('favicon.ico', 'system', uploadedFile.path, function (err, image) {
			file.delete(uploadedFile.path);
			if (err) {
				return next(err);
			}

			res.json([{ name: uploadedFile.name, url: image.url }]);
		});
	}
};

uploadsController.uploadTouchIcon = function (req, res, next) {
	var uploadedFile = req.files.files[0];
	var allowedTypes = ['image/png'];
	var sizes = [36, 48, 72, 96, 144, 192];

	if (validateUpload(req, res, next, uploadedFile, allowedTypes)) {
		file.saveFileToLocal('touchicon-orig.png', 'system', uploadedFile.path, function (err, imageObj) {
			if (err) {
				return next(err);
			}

			// Resize the image into squares for use as touch icons at various DPIs
			async.each(sizes, function (size, next) {
				async.series([
					async.apply(file.saveFileToLocal, 'touchicon-' + size + '.png', 'system', uploadedFile.path),
					async.apply(image.resizeImage, {
						path: path.join(nconf.get('upload_path'), 'system', 'touchicon-' + size + '.png'),
						extension: 'png',
						width: size,
						height: size,
					}),
				], next);
			}, function (err) {
				file.delete(uploadedFile.path);

				if (err) {
					return next(err);
				}

				res.json([{ name: uploadedFile.name, url: imageObj.url }]);
			});
		});
	}
};

uploadsController.uploadLogo = function (req, res, next) {
	upload('site-logo', req, res, next);
};

uploadsController.uploadSound = function (req, res, next) {
	var uploadedFile = req.files.files[0];

	var mimeType = mime.getType(uploadedFile.name);
	if (!/^audio\//.test(mimeType)) {
		return next(Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			file.saveFileToLocal(uploadedFile.name, 'sounds', uploadedFile.path, next);
		},
		function (uploadedSound, next) {
			meta.sounds.build(next);
		},
	], function (err) {
		file.delete(uploadedFile.path);
		if (err) {
			return next(err);
		}
		res.json([{}]);
	});
};

uploadsController.uploadDefaultAvatar = function (req, res, next) {
	upload('avatar-default', req, res, next);
};

uploadsController.uploadOgImage = function (req, res, next) {
	upload('og:image', req, res, next);
};

function upload(name, req, res, next) {
	var uploadedFile = req.files.files[0];

	if (validateUpload(req, res, next, uploadedFile, allowedImageTypes)) {
		var filename = name + path.extname(uploadedFile.name);
		uploadImage(filename, 'system', uploadedFile, req, res, next);
	}
}

function validateUpload(req, res, next, uploadedFile, allowedTypes) {
	if (allowedTypes.indexOf(uploadedFile.type) === -1) {
		file.delete(uploadedFile.path);
		res.json({ error: '[[error:invalid-image-type, ' + allowedTypes.join('&#44; ') + ']]' });
		return false;
	}

	return true;
}

function uploadImage(filename, folder, uploadedFile, req, res, next) {
	async.waterfall([
		function (next) {
			if (plugins.hasListeners('filter:uploadImage')) {
				plugins.fireHook('filter:uploadImage', { image: uploadedFile, uid: req.user.uid }, next);
			} else {
				file.saveFileToLocal(filename, folder, uploadedFile.path, next);
			}
		},
		function (imageData, next) {
			// Post-processing for site-logo
			if (path.basename(filename, path.extname(filename)) === 'site-logo' && folder === 'system') {
				var uploadPath = path.join(nconf.get('upload_path'), folder, 'site-logo-x50.png');
				async.series([
					async.apply(image.resizeImage, {
						path: uploadedFile.path,
						target: uploadPath,
						extension: 'png',
						height: 50,
					}),
					async.apply(meta.configs.set, 'brand:emailLogo', path.join(nconf.get('upload_url'), 'system/site-logo-x50.png')),
				], function (err) {
					next(err, imageData);
				});
			} else {
				setImmediate(next, null, imageData);
			}
		},
	], function (err, image) {
		file.delete(uploadedFile.path);
		if (err) {
			return next(err);
		}
		res.json([{ name: uploadedFile.name, url: image.url.startsWith('http') ? image.url : nconf.get('relative_path') + image.url }]);
	});
}
