'use strict';

var fs = require('fs');
var nconf = require('nconf');
var path = require('path');
var winston = require('winston');
var mkdirp = require('mkdirp');
var mime = require('mime');
var graceful = require('graceful-fs');

var utils = require('./utils');

graceful.gracefulify(fs);

var file = module.exports;

/**
 * Asynchronously copies `src` to `dest`
 * @param {string} src - source filename to copy
 * @param {string} dest - destination filename of the copy operation
 * @param {function(Error): void} callback
 */
function copyFile(src, dest, callback) {
	var calledBack = false;

	var read;
	var write;

	function done(err) {
		if (calledBack) {
			return;
		}
		calledBack = true;

		if (err) {
			if (read) {
				read.destroy();
			}
			if (write) {
				write.destroy();
			}
		}

		callback(err);
	}

	read = fs.createReadStream(src);
	read.on('error', done);

	write = fs.createWriteStream(dest);
	write.on('error', done);
	write.on('close', function () {
		done();
	});

	read.pipe(write);
}

file.copyFile = (typeof fs.copyFile === 'function') ? fs.copyFile : copyFile;

file.saveFileToLocal = function (filename, folder, tempPath, callback) {
	/*
	 * remarkable doesn't allow spaces in hyperlinks, once that's fixed, remove this.
	 */
	filename = filename.split('.').map(function (name) {
		return utils.slugify(name);
	}).join('.');

	var uploadPath = path.join(nconf.get('upload_path'), folder, filename);

	winston.verbose('Saving file ' + filename + ' to : ' + uploadPath);
	mkdirp(path.dirname(uploadPath), function (err) {
		if (err) {
			return callback(err);
		}

		file.copyFile(tempPath, uploadPath, function (err) {
			if (err) {
				return callback(err);
			}

			callback(null, {
				url: '/assets/uploads/' + (folder ? folder + '/' : '') + filename,
				path: uploadPath,
			});
		});
	});
};

file.base64ToLocal = function (imageData, uploadPath, callback) {
	var buffer = Buffer.from(imageData.slice(imageData.indexOf('base64') + 7), 'base64');
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

	require('sharp')(path, {
		failOnError: true,
	}).metadata(function (err) {
		callback(err);
	});
};

// https://stackoverflow.com/a/31205878/583363
file.appendToFileName = function (filename, string) {
	var dotIndex = filename.lastIndexOf('.');
	if (dotIndex === -1) {
		return filename + string;
	}
	return filename.substring(0, dotIndex) + string + filename.substring(dotIndex);
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
		return extension.toLowerCase();
	});

	if (allowedExtensions.indexOf('.jpg') !== -1 && allowedExtensions.indexOf('.jpeg') === -1) {
		allowedExtensions.push('.jpeg');
	}

	return allowedExtensions;
};

file.exists = function (path, callback) {
	fs.stat(path, function (err) {
		if (err) {
			if (err.code === 'ENOENT') {
				return callback(null, false);
			}
			return callback(err);
		}
		callback(null, true);
	});
};

file.existsSync = function (path) {
	try {
		fs.statSync(path);
	} catch (err) {
		if (err.code === 'ENOENT') {
			return false;
		}
		throw err;
	}

	return true;
};

file.delete = function (path, callback) {
	callback = callback || function () {};
	if (!path) {
		return setImmediate(callback);
	}
	fs.unlink(path, function (err) {
		if (err) {
			winston.warn(err);
		}
		callback();
	});
};

file.link = function link(filePath, destPath, relative, callback) {
	if (!callback) {
		callback = relative;
		relative = false;
	}

	if (relative && process.platform !== 'win32') {
		filePath = path.relative(path.dirname(destPath), filePath);
	}

	if (process.platform === 'win32') {
		fs.link(filePath, destPath, callback);
	} else {
		fs.symlink(filePath, destPath, 'file', callback);
	}
};

file.linkDirs = function linkDirs(sourceDir, destDir, relative, callback) {
	if (!callback) {
		callback = relative;
		relative = false;
	}

	if (relative && process.platform !== 'win32') {
		sourceDir = path.relative(path.dirname(destDir), sourceDir);
	}

	var type = (process.platform === 'win32') ? 'junction' : 'dir';
	fs.symlink(sourceDir, destDir, type, callback);
};

file.typeToExtension = function (type) {
	var extension;
	if (type) {
		extension = '.' + mime.getExtension(type);
	}
	return extension;
};

// Adapted from http://stackoverflow.com/questions/5827612/node-js-fs-readdir-recursive-directory-search
file.walk = function (dir, done) {
	var results = [];

	fs.readdir(dir, function (err, list) {
		if (err) {
			return done(err);
		}
		var pending = list.length;
		if (!pending) {
			return done(null, results);
		}
		list.forEach(function (filename) {
			filename = dir + '/' + filename;
			fs.stat(filename, function (err, stat) {
				if (err) {
					return done(err);
				}

				if (stat && stat.isDirectory()) {
					file.walk(filename, function (err, res) {
						if (err) {
							return done(err);
						}

						results = results.concat(res);
						pending -= 1;
						if (!pending) {
							done(null, results);
						}
					});
				} else {
					results.push(filename);
					pending -= 1;
					if (!pending) {
						done(null, results);
					}
				}
			});
		});
	});
};
