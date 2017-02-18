"use strict";

var fs = require('fs');
var nconf = require('nconf');
var path = require('path');
var winston = require('winston');
var jimp = require('jimp');
var mkdirp = require('mkdirp');

var utils = require('../public/src/utils');

var file = {};

file.saveFileToLocal = function (filename, folder, tempPath, callback) {
	/*
	* remarkable doesn't allow spaces in hyperlinks, once that's fixed, remove this.
	*/
	filename = filename.split('.');
	filename.forEach(function (name, idx) {
		filename[idx] = utils.slugify(name);
	});
	filename = filename.join('.');

	var uploadPath = path.join(nconf.get('upload_path'), folder, filename);

	winston.verbose('Saving file ' + filename + ' to : ' + uploadPath);
	mkdirp(path.dirname(uploadPath), function (err) {
		if (err) {
			callback(err);
		}

		var is = fs.createReadStream(tempPath);
		var os = fs.createWriteStream(uploadPath);
		is.on('end', function () {
			callback(null, {
				url: '/assets/uploads/' + folder + '/' + filename,
				path: uploadPath,
			});
		});

		os.on('error', callback);
		is.pipe(os);
	});
};

file.base64ToLocal = function (imageData, uploadPath, callback) {
	var buffer = new Buffer(imageData.slice(imageData.indexOf('base64') + 7), 'base64');
	uploadPath = path.join(nconf.get('upload_path'), uploadPath);

	fs.writeFile(uploadPath, buffer, {
		encoding: 'base64',
	}, function (err) {
		callback(err, uploadPath);
	});
};

file.isFileTypeAllowed = function (path, callback) {
	var plugins = require('./plugins');
	if (plugins.hasListeners('filter:file.isFileTypeAllowed')) {
		return plugins.fireHook('filter:file.isFileTypeAllowed', path, function (err) {
			callback(err);
		});
	}

	// Attempt to read the file, if it passes, file type is allowed
	jimp.read(path, function (err) {
		callback(err);
	});
};

file.allowedExtensions = function () {
	var meta = require('./meta');
	var allowedExtensions = (meta.config.allowedFileExtensions || '').trim();
	if (!allowedExtensions) {
		return [];
	}
	allowedExtensions = allowedExtensions.split(',');
	allowedExtensions = allowedExtensions.filter(Boolean).map(function (extension) {
		extension = extension.trim();
		if (!extension.startsWith('.')) {
			extension = '.' + extension;
		}
		return extension;
	});

	if (allowedExtensions.indexOf('.jpg') !== -1 && allowedExtensions.indexOf('.jpeg') === -1) {
		allowedExtensions.push('.jpeg');
	}

	return allowedExtensions;
};

file.exists = function (path, callback) {
	fs.stat(path, function (err, stat) {
		callback(!err && stat);
	});
};

file.existsSync = function (path) {
	var exists = false;
	try {
		exists = fs.statSync(path);
	} catch (err) {
		exists = false;
	}

	return !!exists;
};

file.link = function link(filePath, destPath, cb) {
	if (process.platform === 'win32') {
		fs.link(filePath, destPath, cb);
	} else {
		fs.symlink(filePath, destPath, 'file', cb);
	}
};

file.linkDirs = function linkDirs(sourceDir, destDir, callback) {
	var type = (process.platform === 'win32') ? 'junction' : 'dir';
	fs.symlink(sourceDir, destDir, type, callback);
};

module.exports = file;
