'use strict';

var path = require('path');
var nconf = require('nconf');
var winston = require('winston');

var db = require('../database');
var file = require('../file');
var batch = require('../batch');

module.exports = function (User) {
	User.deleteUpload = async function (callerUid, uid, uploadName) {
		const [isUsersUpload, isAdminOrGlobalMod] = await Promise.all([
			db.isSortedSetMember('uid:' + callerUid + ':uploads', uploadName),
			User.isAdminOrGlobalMod(callerUid),
		]);
		if (!isAdminOrGlobalMod && !isUsersUpload) {
			throw new Error('[[error:no-privileges]]');
		}

		winston.verbose('[user/deleteUpload] Deleting ' + uploadName);
		await Promise.all([
			file.delete(path.join(nconf.get('upload_path'), uploadName)),
			file.delete(path.join(nconf.get('upload_path'), path.dirname(uploadName), path.basename(uploadName, path.extname(uploadName)) + '-resized' + path.extname(uploadName))),
		]);
		await db.sortedSetRemove('uid:' + uid + ':uploads', uploadName);
	};

	User.collateUploads = async function (uid, archive) {
		await batch.processSortedSet('uid:' + uid + ':uploads', function (files, next) {
			files.forEach(function (file) {
				archive.file(path.join(nconf.get('upload_path'), file), {
					name: path.basename(file),
				});
			});

			setImmediate(next);
		}, { batch: 100 });
	};
};
