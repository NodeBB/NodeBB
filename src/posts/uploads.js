'use strict';

var async = require('async');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var db = require('../database');

module.exports = function (Posts) {
	Posts.uploads = {};

	const md5 = filename => crypto.createHash('md5').update(filename).digest('hex');
	const pathPrefix = path.join(__dirname, '../../public/uploads/files');
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
};
