'use strict';

var async = require('async');

var db = require('../database');

module.exports = function (Posts) {
	Posts.uploads = {};

	Posts.uploads.sync = function (pid, callback) {
		// Scans a post and updates sorted set of uploads
		const searchRegex = /\/assets\/uploads\/files\/([^\s")]+\.?[\w]*)/g;

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
				uploads.push(match[1]);
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

	Posts.uploads.associate = function (pid, filePaths, callback) {
		// Adds an upload to a post's sorted set of uploads
		const now = Date.now();
		filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;
		const scores = filePaths.map(() => now);

		db.sortedSetAdd('post:' + pid + ':uploads', scores, filePaths, callback);
	};

	Posts.uploads.dissociate = function (pid, filePaths, callback) {
		// Removes an upload from a post's sorted set of uploads
		filePaths = !Array.isArray(filePaths) ? [filePaths] : filePaths;

		db.sortedSetRemove('post:' + pid + ':uploads', filePaths, callback);
	};
};
