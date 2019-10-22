'use strict';

const async = require('async');
const nconf = require('nconf');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const mime = require('mime');

const db = require('../database');
const image = require('../image');

module.exports = function (Posts) {
	Posts.uploads = {};

	const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
	const pathPrefix = path.join(nconf.get('upload_path'), 'files');
	const searchRegex = /\/assets\/uploads\/files\/([^\s")]+\.?[\w]*)/g;

	Posts.uploads.sync = async function (pid) {
		// Scans a post's content and updates sorted set of uploads

		const [content, currentUploads] = await Promise.all([
			Posts.getPostField(pid, 'content'),
			Posts.uploads.list(pid),
		]);

		// Extract upload file paths from post content
		let match = searchRegex.exec(content);
		const uploads = [];
		while (match) {
			uploads.push(match[1].replace('-resized', ''));
			match = searchRegex.exec(content);
		}

		// Create add/remove sets
		const add = uploads.filter(path => !currentUploads.includes(path));
		const remove = currentUploads.filter(path => !uploads.includes(path));
		await Promise.all([
			Posts.uploads.associate(pid, add),
			Posts.uploads.dissociate(pid, remove),
		]);
	};

	Posts.uploads.list = async function (pid) {
		return await db.getSortedSetRange('post:' + pid + ':uploads', 0, -1);
	};

	Posts.uploads.listWithSizes = async function (pid) {
		const paths = await Posts.uploads.list(pid);
		const sizes = await db.getObjects(paths.map(path => 'upload:' + md5(path))) || [];

		return sizes.map((sizeObj, idx) => ({
			...sizeObj,
			name: paths[idx],
		}));
	};

	Posts.uploads.isOrphan = async function (filePath) {
		const length = await db.sortedSetCard('upload:' + md5(filePath) + ':pids');
		return length === 0;
	};

	Posts.uploads.getUsage = async function (filePaths) {
		// Given an array of file names, determines which pids they are used in
		if (!Array.isArray(filePaths)) {
			filePaths = [filePaths];
		}

		const keys = filePaths.map(fileObj => 'upload:' + md5(fileObj.name.replace('-resized', '')) + ':pids');
		return await Promise.all(keys.map(k => db.getSortedSetRange(k, 0, -1)));
	};

	Posts.uploads.associate = async function (pid, filePaths) {
		// Adds an upload to a post's sorted set of uploads
		filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
		if (!filePaths.length) {
			return;
		}
		filePaths = await async.filter(filePaths, function (filePath, next) {
			// Only process files that exist
			fs.access(path.join(pathPrefix, filePath), fs.constants.F_OK | fs.constants.R_OK, function (err) {
				next(null, !err);
			});
		});

		const now = Date.now();
		const scores = filePaths.map(() => now);
		const bulkAdd = filePaths.map(path => ['upload:' + md5(path) + ':pids', now, pid]);
		await Promise.all([
			db.sortedSetAdd('post:' + pid + ':uploads', scores, filePaths),
			db.sortedSetAddBulk(bulkAdd),
			Posts.uploads.saveSize(filePaths),
		]);
	};

	Posts.uploads.dissociate = async function (pid, filePaths) {
		// Removes an upload from a post's sorted set of uploads
		filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
		if (!filePaths.length) {
			return;
		}

		const bulkRemove = filePaths.map(path => ['upload:' + md5(path) + ':pids', pid]);
		await Promise.all([
			db.sortedSetRemove('post:' + pid + ':uploads', filePaths),
			db.sortedSetRemoveBulk(bulkRemove),
		]);
	};

	Posts.uploads.dissociateAll = async (pid) => {
		const current = await Posts.uploads.list(pid);
		await Promise.all(current.map(async path => await Posts.uploads.dissociate(pid, path)));
	};

	Posts.uploads.saveSize = async (filePaths) => {
		filePaths = filePaths.filter((fileName) => {
			const type = mime.getType(fileName);
			return type && type.match(/image./);
		});
		await Promise.all(filePaths.map(async function (fileName) {
			try {
				const size = await image.size(path.join(pathPrefix, fileName));
				winston.verbose('[posts/uploads/' + fileName + '] Saving size');
				await db.setObject('upload:' + md5(fileName), {
					width: size.width,
					height: size.height,
				});
			} catch (err) {
				winston.error('[posts/uploads] Error while saving post upload sizes (' + fileName + '): ' + err.message);
			}
		}));
	};
};
