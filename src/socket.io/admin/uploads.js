'use strict';

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

const Uploads = module.exports;

Uploads.delete = function (socket, pathToFile, callback) {
	pathToFile = path.join(nconf.get('upload_path'), pathToFile);
	if (!pathToFile.startsWith(nconf.get('upload_path'))) {
		return callback(new Error('[[error:invalid-path]]'));
	}

	fs.unlink(pathToFile, callback);
};
