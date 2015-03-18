"use strict";

var fs = require('fs'),
	nconf = require('nconf'),
	path = require('path'),
	winston = require('winston'),
	mmmagic = require('mmmagic'),
	Magic = mmmagic.Magic,
	mime = require('mime'),

	meta= require('./meta');

var file = {};

file.saveFileToLocal = function(filename, folder, tempPath, callback) {

	var uploadPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), folder, filename);

	winston.verbose('Saving file '+ filename +' to : ' + uploadPath);

	var is = fs.createReadStream(tempPath);
	var os = fs.createWriteStream(uploadPath);

	is.on('end', function () {
		callback(null, {
			url: nconf.get('upload_url') + folder + '/' + encodeURIComponent(filename)
		});
	});

	os.on('error', callback);

	is.pipe(os);
};

file.isFileTypeAllowed = function(path, allowedExtensions, callback) {
	if (!Array.isArray(allowedExtensions) || !allowedExtensions.length) {
		return callback();
	}

	allowedExtensions = allowedExtensions.filter(Boolean).map(function(extension) {
		return extension.trim();
	});

	var magic = new Magic(mmmagic.MAGIC_MIME_TYPE);
	magic.detectFile(path, function(err, mimeType) {
		if (err) {
			return callback(err);
		}

		var uploadedFileExtension = mime.extension(mimeType);

		if (allowedExtensions.indexOf(uploadedFileExtension) === -1) {
			return callback(new Error('[[error:invalid-file-type, ' + allowedExtensions.join('-') + ']]'));
		}

		callback();
	});
};

file.allowedExtensions = function() {
	var allowedExtensions = (meta.config.allowedFileExtensions || '').trim();
	if (!allowedExtensions) {
		return [];
	}
	allowedExtensions = allowedExtensions.split(',');
	return allowedExtensions;
};

module.exports = file;