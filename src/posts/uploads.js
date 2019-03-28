'use strict';

var async = require('async');
var nconf = require('nconf');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var util = require('util');
var winston = require('winston');

var db = require('../database');
const image = require('../image');

module.exports = function (Posts) {
	Posts.uploads = {};

	const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
	const pathPrefix = path.join(nconf.get('upload_path'), 'files');
	const searchRegex = /\/assets\/uploads\/files\/([^\s")]+\.?[\w]*)/g;

	Posts.uploads.sync = function (pid, callback) {
		// Scans a post and updates sorted set of uploads

		async.parallel({
			content: async.apply(Posts.getPostField, pid, 'content'),
			uploads: async.apply(Posts.uploads.list, pid),
		}, function (err, data) {
			if (err) {
				return callback(err);
			}

			// Extract upload file paths from post content
			let match = searchRegex.exec(data.content);
			const uploads = [];
			while (match) {
				uploads.push(match[1].replace('-resized', ''));
				match = searchRegex.exec(data.content);
			}

			// Create add/remove sets
			const add = uploads.filter(path => !data.uploads.includes(path));
			const remove = data.uploads.filter(path => !uploads.includes(path));

			async.parallel([
				async.apply(Posts.uploads.associate, pid, add),
				async.apply(Posts.uploads.dissociate, pid, remove),
			], function (err) {
				// Strictly return only err
				callback(err);
			});
		});
	};

	Posts.uploads.list = function (pid, callback) {
		// Returns array of this post's uploads
		db.getSortedSetRange('post:' + pid + ':uploads', 0, -1, callback);
	};

	Posts.uploads.listWithSizes = async function (pid) {
		const paths = await Posts.async.uploads.list(pid);
		const sizes = await db.async.getObjects(paths.map(path => 'upload:' + md5(path))) || [];

		return sizes.map((sizeObj, idx) => ({
			...sizeObj,
			name: paths[idx],
		}));
	};

	Posts.uploads.isOrphan = function (filePath, callback) {
		// Returns bool indicating whether a file is still CURRENTLY included in any posts
		db.sortedSetCard('upload:' + md5(filePath) + ':pids', function (err, length) {
			callback(err, length === 0);
		});
	};

	Posts.uploads.getUsage = function (filePaths, callback) {
		// Given an array of file names, determines which pids they are used in
		if (!Array.isArray(filePaths)) {
			filePaths = [filePaths];
		}

		const keys = filePaths.map(fileObj => 'upload:' + md5(fileObj.name.replace('-resized', '')) + ':pids');
		async.map(keys, function (key, next) {
			db.getSortedSetRange(key, 0, -1, next);
		}, callback);
	};

	Posts.uploads.associate = function (pid, filePaths, callback) {
		// Adds an upload to a post's sorted set of uploads
		filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
		if (!filePaths.length) {
			return setImmediate(callback);
		}
		async.filter(filePaths, function (filePath, next) {
			// Only process files that exist
			fs.access(path.join(pathPrefix, filePath), fs.constants.F_OK | fs.constants.R_OK, function (err) {
				next(null, !err);
			});
		}, function (err, filePaths) {
			if (err) {
				return callback(err);
			}
			const now = Date.now();
			const scores = filePaths.map(() => now);
			let methods = [async.apply(db.sortedSetAdd.bind(db), 'post:' + pid + ':uploads', scores, filePaths)];

			methods = methods.concat(filePaths.map(path => async.apply(db.sortedSetAdd.bind(db), 'upload:' + md5(path) + ':pids', now, pid)));
			methods = methods.concat(async function () {
				await Posts.uploads.saveSize(filePaths);
			});
			async.parallel(methods, function (err) {
				// Strictly return only err
				callback(err);
			});
		});
	};

	Posts.uploads.dissociate = function (pid, filePaths, callback) {
		// Removes an upload from a post's sorted set of uploads
		filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
		if (!filePaths.length) {
			return setImmediate(callback);
		}
		let methods = [async.apply(db.sortedSetRemove.bind(db), 'post:' + pid + ':uploads', filePaths)];
		methods = methods.concat(filePaths.map(path => async.apply(db.sortedSetRemove.bind(db), 'upload:' + md5(path) + ':pids', pid)));

		async.parallel(methods, function (err) {
			// Strictly return only err
			callback(err);
		});
	};

	Posts.uploads.saveSize = async (filePaths) => {
		const getSize = util.promisify(image.size);
		const sizes = await Promise.all(filePaths.map(async function (fileName) {
			try {
				return await getSize(path.join(pathPrefix, fileName));
			} catch (e) {
				// Error returned by getSize, do not save size in database
				return null;
			}
		}));

		const methods = filePaths.map((filePath, idx) => {
			if (!sizes[idx]) {
				return null;
			}

			winston.verbose('[posts/uploads/' + filePath + '] Saving size');
			return async.apply(db.setObject, 'upload:' + md5(filePath), {
				width: sizes[idx].width,
				height: sizes[idx].height,
			});
		}).filter(Boolean);
		async.parallel(methods, function (err) {
			if (err) {
				winston.error('[posts/uploads] Error while saving post upload sizes: ', err.message);
			} else {
				winston.verbose('[posts/uploads] Finished saving post upload sizes.');
			}
		});
	};
};
