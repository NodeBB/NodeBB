'use strict';

const path = require('path');
const nconf = require('nconf');
const winston = require('winston');
const crypto = require('crypto');

const db = require('../database');
const posts = require('../posts');
const file = require('../file');
const batch = require('../batch');

const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
const _getFullPath = relativePath => path.resolve(nconf.get('upload_path'), relativePath);
const _validatePath = async (relativePaths) => {
	if (typeof relativePaths === 'string') {
		relativePaths = [relativePaths];
	} else if (!Array.isArray(relativePaths)) {
		throw new Error(`[[error:wrong-parameter-type, relativePaths, ${typeof relativePaths}, array]]`);
	}

	const fullPaths = relativePaths.map(path => _getFullPath(path));
	const exists = await Promise.all(fullPaths.map(async fullPath => file.exists(fullPath)));

	if (!fullPaths.every(fullPath => fullPath.startsWith(nconf.get('upload_path'))) || !exists.every(Boolean)) {
		throw new Error('[[error:invalid-path]]');
	}
};

module.exports = function (User) {
	User.associateUpload = async (uid, relativePath) => {
		await _validatePath(relativePath);
		await Promise.all([
			db.sortedSetAdd(`uid:${uid}:uploads`, Date.now(), relativePath),
			db.setObjectField(`upload:${md5(relativePath)}`, 'uid', uid),
		]);
	};

	User.deleteUpload = async function (callerUid, uid, uploadNames) {
		if (typeof uploadNames === 'string') {
			uploadNames = [uploadNames];
		} else if (!Array.isArray(uploadNames)) {
			throw new Error(`[[error:wrong-parameter-type, uploadNames, ${typeof uploadNames}, array]]`);
		}

		await _validatePath(uploadNames);

		const [isUsersUpload, isAdminOrGlobalMod] = await Promise.all([
			db.isSortedSetMembers(`uid:${callerUid}:uploads`, uploadNames),
			User.isAdminOrGlobalMod(callerUid),
		]);
		if (!isAdminOrGlobalMod && !isUsersUpload.every(Boolean)) {
			throw new Error('[[error:no-privileges]]');
		}

		await batch.processArray(uploadNames, async (uploadNames) => {
			const fullPaths = uploadNames.map(path => _getFullPath(path));

			await Promise.all(fullPaths.map(async (fullPath, idx) => {
				winston.verbose(`[user/deleteUpload] Deleting ${uploadNames[idx]}`);
				await Promise.all([
					file.delete(fullPath),
					file.delete(file.appendToFileName(fullPath, '-resized')),
				]);
				await Promise.all([
					db.sortedSetRemove(`uid:${uid}:uploads`, uploadNames[idx]),
					db.delete(`upload:${md5(uploadNames[idx])}`),
				]);
			}));

			// Dissociate the upload from pids, if any
			const pids = await db.getSortedSetsMembers(uploadNames.map(relativePath => `upload:${md5(relativePath)}:pids`));
			await Promise.all(pids.map(async (pids, idx) => Promise.all(
				pids.map(async pid => posts.uploads.dissociate(pid, uploadNames[idx]))
			)));
		}, { batch: 50 });
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
