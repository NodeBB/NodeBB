'use strict';

const path = require('path');
const nconf = require('nconf');
const winston = require('winston');
const crypto = require('crypto');

const db = require('../database');
const file = require('../file');
const batch = require('../batch');

const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
const _getFullPath = relativePath => path.resolve(nconf.get('upload_path'), relativePath);
const _validatePath = async (relativePath) => {
	const fullPath = _getFullPath(relativePath);
	const exists = await file.exists(fullPath);

	if (!fullPath.startsWith(nconf.get('upload_path')) || !exists) {
		throw new Error('[[error:invalid-path]]');
	}
};

module.exports = function (User) {
	User.associateUpload = async (uid, relativePath) => {
		await _validatePath(relativePath);
		await Promise.all([
			db.sortedSetAdd(`uid:${uid}:uploads`, Date.now(), relativePath),
			db.setObjectField(`upload:${md5(relativePath)}:uid`, uid),
		]);
	};

	User.deleteUpload = async function (callerUid, uid, uploadName) {
		const [isUsersUpload, isAdminOrGlobalMod] = await Promise.all([
			db.isSortedSetMember(`uid:${callerUid}:uploads`, uploadName),
			User.isAdminOrGlobalMod(callerUid),
		]);
		if (!isAdminOrGlobalMod && !isUsersUpload) {
			throw new Error('[[error:no-privileges]]');
		}

		await _validatePath(uploadName);
		const fullPath = _getFullPath(uploadName);
		winston.verbose(`[user/deleteUpload] Deleting ${uploadName}`);
		await Promise.all([
			file.delete(fullPath),
			file.delete(file.appendToFileName(fullPath, '-resized')),
		]);
		await db.sortedSetRemove(`uid:${uid}:uploads`, uploadName);
	};

	User.collateUploads = async function (uid, archive) {
		await batch.processSortedSet(`uid:${uid}:uploads`, (files, next) => {
			files.forEach((file) => {
				archive.file(_getFullPath(file), {
					name: path.basename(file),
				});
			});

			setImmediate(next);
		}, { batch: 100 });
	};
};
