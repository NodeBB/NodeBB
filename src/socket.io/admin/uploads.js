'use strict';

const fs = require('fs');
const path = require('path');
const nconf = require('nconf');

const sockets = require('..');

const Uploads = module.exports;

Uploads.delete = function (socket, pathToFile, callback) {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/files');

	pathToFile = path.join(nconf.get('upload_path'), pathToFile);
	if (!pathToFile.startsWith(nconf.get('upload_path'))) {
		return callback(new Error('[[error:invalid-path]]'));
	}

	fs.unlink(pathToFile, callback);
};
