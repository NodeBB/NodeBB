'use strict';

var fs = require('fs');
var nconf = require('nconf');
var path = require('path');
var winston = require('winston');
var jimp = require('jimp');
var mkdirp = require('mkdirp');
var mime = require('mime');

var utils = require('./utils');

var file = module.exports;

file.copyFile = function (src, dst, opts, cb) {
	/* Wrapper for copyFile function with code to handle it not being present. If/When nodejs 8.5 or greater is a baseline requirement/assumption,
	   this can be pruned and wholesale replace in all calls with fs.copyFile. */

	function noop() {}

	function copyHelper(err) {
		var is;
		var os;

		if (!err && !(opts.replace || opts.overwrite)) {
			return cb(new Error('File ' + dst + ' exists.'));
		}

		fs.stat(src, function (err, stat) {
			if (err) {
				return cb(err);
			}

			is = fs.createReadStream(src);
			os = fs.createWriteStream(dst);

			is.pipe(os);
			os.on('close', function (err) {
				if (err) {
					return cb(err);
				}
				fs.utimes(dst, stat.atime, stat.mtime, cb);
			});
		});
	}

	/* Test for availability of fs.CopyFile */
	const semver = require('semver');

	if (semver.gte(process.version, '8.5.0')) {
		fs.copyFile(src, dst, opts, cb);
	} else {
		/* lifted nearly wholesale from https://github.com/coolaj86/utile-fs/blob/master/fs.extra/fs.copy.js */
		if (typeof opts === 'function') {
			cb = opts;
			opts = null;
		}
		opts = opts || {};

		cb = cb || noop;
		fs.stat(dst, copyHelper);
	}
};


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
	});

	/* When nodeJS 8.5.0 is below the assumed base, change this to fs.copyfile and remove the above function */

	file.copyFile(tempPath, uploadPath, {}, function (err) {
		if (err) {
			callback();
		} else {
			callback(null, {
				url: '/assets/uploads/' + folder + '/' + filename,
				path: uploadPath,
			});
		}
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
		}
		callback(err, true);
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

file.delete = function (path) {
	if (path) {
		fs.unlink(path, function (err) {
			if (err) {
				winston.error(err);
			}
		});
	}
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
