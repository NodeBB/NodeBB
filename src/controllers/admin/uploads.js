'use strict';

var path = require('path');
var async = require('async');
var nconf = require('nconf');
var mime = require('mime');
var fs = require('fs');

var meta = require('../../meta');
var posts = require('../../posts');
var file = require('../../file');
var image = require('../../image');
var plugins = require('../../plugins');
var pagination = require('../../pagination');

var allowedImageTypes = ['image/png', 'image/jpeg', 'image/pjpeg', 'image/jpg', 'image/gif', 'image/svg+xml'];

var uploadsController = module.exports;

uploadsController.get = function (req, res, next) {
	var currentFolder = path.join(nconf.get('upload_path'), req.query.dir || '');
	if (!currentFolder.startsWith(nconf.get('upload_path'))) {
		return next(new Error('[[error:invalid-path]]'));
	}
	var itemsPerPage = 20;
	var itemCount = 0;
	var page = parseInt(req.query.page, 10) || 1;
	async.waterfall([
		function (next) {
			fs.readdir(currentFolder, next);
		},
		function (files, next) {
			files = files.filter(function (filename) {
				return filename !== '.gitignore';
			});

			itemCount = files.length;
			var start = Math.max(0, (page - 1) * itemsPerPage);
			var stop = start + itemsPerPage;
			files = files.slice(start, stop);

			filesToData(currentFolder, files, next);
		},
		function (files, next) {
			// Float directories to the top
			files.sort(function (a, b) {
				if (a.isDirectory && !b.isDirectory) {
					return -1;
				} else if (!a.isDirectory && b.isDirectory) {
					return 1;
				} else if (!a.isDirectory && !b.isDirectory) {
					return a.mtime < b.mtime ? -1 : 1;
				}

				return 0;
			});

			// Add post usage info if in /files
			if (req.query.dir === '/files') {
				posts.uploads.getUsage(files, function (err, usage) {
					files.forEach(function (file, idx) {
						file.inPids = usage[idx].map(pid => parseInt(pid, 10));
					});

					next(err, files);
				});
			} else {
				setImmediate(next, null, files);
			}
		},
		function (files) {
			res.render('admin/manage/uploads', {
				currentFolder: currentFolder.replace(nconf.get('upload_path'), ''),
				showPids: files.length && files[0].hasOwnProperty('inPids'),
				files: files,
				breadcrumbs: buildBreadcrumbs(currentFolder),
				pagination: pagination.create(page, Math.ceil(itemCount / itemsPerPage), req.query),
			});
		},
	], next);
};

function buildBreadcrumbs(currentFolder) {
	var crumbs = [];
	var parts = currentFolder.replace(nconf.get('upload_path'), '').split(path.sep);
	var currentPath = '';
	parts.forEach(function (part) {
		var dir = path.join(currentPath, part);
		crumbs.push({
			text: part || 'Uploads',
			url: part
				? (nconf.get('relative_path') + '/admin/manage/uploads?dir=' + dir)
				: nconf.get('relative_path') + '/admin/manage/uploads',
		});
		currentPath = dir;
	});

	return crumbs;
}

function filesToData(currentDir, files, callback) {
	async.map(files, function (file, next) {
		var stat;
		async.waterfall([
			function (next) {
				fs.stat(path.join(currentDir, file), next);
			},
			function (_stat, next) {
				stat = _stat;
				if (stat.isDirectory()) {
					fs.readdir(path.join(currentDir, file), next);
				} else {
					next(null, []);
				}
			},
			function (filesInDir, next) {
				var url = nconf.get('upload_url') + currentDir.replace(nconf.get('upload_path'), '') + '/' + file;
				next(null, {
					name: file,
					path: path.join(currentDir, file).replace(nconf.get('upload_path'), ''),
					url: url,
					fileCount: Math.max(0, filesInDir.length - 1), // ignore .gitignore
					size: stat.size,
					sizeHumanReadable: (stat.size / 1024).toFixed(1) + 'KiB',
					isDirectory: stat.isDirectory(),
					isFile: stat.isFile(),
					mtime: stat.mtimeMs,
				});
			},
		], next);
	}, callback);
}

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
			async.eachSeries(sizes, function (size, next) {
				image.resizeImage({
					path: uploadedFile.path,
					target: path.join(nconf.get('upload_path'), 'system', 'touchicon-' + size + '.png'),
					width: size,
					height: size,
				}, next);
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

uploadsController.uploadFile = function (req, res, next) {
	var uploadedFile = req.files.files[0];
	var params;
	try {
		params = JSON.parse(req.body.params);
	} catch (e) {
		file.delete(uploadedFile.path);
		return next(new Error('[[error:invalid-json]]'));
	}

	file.saveFileToLocal(uploadedFile.name, params.folder, uploadedFile.path, function (err, data) {
		file.delete(uploadedFile.path);
		if (err) {
			return next(err);
		}
		res.json([{ url: data.url }]);
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
				plugins.fireHook('filter:uploadImage', { image: uploadedFile, uid: req.uid }, next);
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
						height: 50,
					}),
					async.apply(meta.configs.set, 'brand:emailLogo', path.join(nconf.get('upload_url'), 'system/site-logo-x50.png')),
				], function (err) {
					next(err, imageData);
				});
			} else if (path.basename(filename, path.extname(filename)) === 'og:image' && folder === 'system') {
				image.size(imageData.path, function (err, size) {
					if (err) {
						next(err);
					}
					meta.configs.setMultiple({
						'og:image:width': size.width,
						'og:image:height': size.height,
					}, function (err) {
						next(err, imageData);
					});
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

