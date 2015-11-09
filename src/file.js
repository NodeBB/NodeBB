"use strict";

var fs = require('fs'),
	nconf = require('nconf'),
	path = require('path'),
	winston = require('winston'),
	mmmagic = require('mmmagic'),
	Magic = mmmagic.Magic,
	mime = require('mime'),
	jimp = require('jimp'),

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

file.isFileTypeAllowed = function(path, callback) {
	// Attempt to read the file, if it passes, file type is allowed
	jimp.read(path, function(err) {
		callback(err);
	});
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