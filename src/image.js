
var fs = require('fs'),
	imagemagick = require('node-imagemagick'),
	meta = require('./meta');

var image = {};

image.resizeImage = function(path, extension, width, height, callback) {
	function done(err, stdout, stderr) {
		callback(err);
	}

	if(extension === '.gif') {
		imagemagick.convert([
			path,
			'-coalesce',
			'-repage',
			'0x0',
			'-crop',
			width+'x'+height+'+0+0',
			'+repage',
			path
		], done);
	} else {
		imagemagick.crop({
			srcPath: path,
			dstPath: path,
			width: width,
			height: height
		}, done);
	}
};

image.convertImageToPng = function(path, extension, callback) {
	var convertToPNG = parseInt(meta.config['profile:convertProfileImageToPNG'], 10);
	if(convertToPNG && extension !== '.png') {
		imagemagick.convert([path, 'png:-'], function(err, stdout) {
			if(err) {
				return callback(err);
			}

			fs.writeFile(path, stdout, 'binary', callback);
		});
	} else {
		callback();
	}
};

image.convertImageToBase64 = function(path, callback) {
	fs.readFile(path, function(err, data) {
		callback(err, data ? data.toString('base64') : null);
	});
}

module.exports = image;