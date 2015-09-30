"use strict";

var fs = require('fs'),
	nconf = require('nconf'),
	path = require('path'),
	winston = require('winston'),
	mmmagic = require('mmmagic'),
	Magic = mmmagic.Magic,
	mime = require('mime'),

	utils = require('../public/src/utils');

var file = {};

file.saveFileToLocal = function(filename, folder, tempPath, callback) {
	/*
	* remarkable doesn't allow spaces in hyperlinks, once that's fixed, remove this.
	*/
	filename = filename.split('.');
	filename.forEach(function(name, idx) {
		filename[idx] = utils.slugify(name);
	});
	filename = filename.join('.');

	var uploadPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), folder, filename);

	winston.verbose('Saving file '+ filename +' to : ' + uploadPath);

	var is = fs.createReadStream(tempPath);
	var os = fs.createWriteStream(uploadPath);

	is.on('end', function () {
		callback(null, {
			url: nconf.get('upload_url') + folder + '/' + filename
		});
	});

	os.on('error', callback);

	is.pipe(os);
};

file.isFileTypeAllowed = function(path, allowedExtensions, callback) {
	if (!Array.isArray(allowedExtensions) || !allowedExtensions.length) {
		return callback();
	}

	var magic = new Magic(mmmagic.MAGIC_MIME_TYPE);
	magic.detectFile(path, function(err, mimeType) {
		if (err) {
			return callback(err);
		}

		var uploadedFileExtension = mime.extension(mimeType);

		if (allowedExtensions.indexOf(uploadedFileExtension) === -1) {
			return callback(new Error('[[error:invalid-file-type, ' + allowedExtensions.join(', ') + ']]'));
		}

		callback();
	});
};

file.allowedExtensions = function() {
	var meta = require('./meta');
	var allowedExtensions = (meta.config.allowedFileExtensions || '').trim();
	if (!allowedExtensions) {
		return [];
	}
	allowedExtensions = allowedExtensions.split(',');
	allowedExtensions = allowedExtensions.filter(Boolean).map(function(extension) {
		extension = extension.trim();
		return extension.replace(/\./g, '');
	});

	if (allowedExtensions.indexOf('jpg') !== -1 && allowedExtensions.indexOf('jpeg') === -1) {
		allowedExtensions.push('jpeg');
	}

	return allowedExtensions;
};

file.exists = function(path, callback) {
	fs.stat(path, function(err, stat) {
		callback(!err && stat);
	});
};

file.existsSync = function(path) {
	var exists = false;
	try {
		exists = fs.statSync(path);
	} catch(err) {
		exists = false;
	}

	return !!exists;
};

module.exports = file;