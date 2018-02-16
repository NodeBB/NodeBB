'use strict';

var async = require('async');

var db = require('../database');
var diff = require('diff');

module.exports = function (Posts) {
	Posts.diffs = {};

	Posts.diffs.exists = function (pid, callback) {
		db.sortedSetCard('post:' + pid + ':diffs', function (err, numDiffs) {
			return callback(err, numDiffs > 0);
		});
	};

	Posts.diffs.list = function (pid, callback) {
		db.getSortedSetRangeWithScores('post:' + pid + ':diffs', 0, -1, function (err, diffs) {
			callback(err, diffs ? diffs.map(function (diffObj) {
				return diffObj.score;
			}) : null);
		});
	};

	Posts.diffs.save = function (pid, oldContent, newContent, callback) {
		db.sortedSetAdd('post:' + pid + ':diffs', Date.now(), diff.createPatch('', newContent, oldContent), callback);
	};

	Posts.diffs.load = function (pid, since, callback) {
		// Retrieves all diffs made since `since` and replays them to reconstruct what the post looked like at `since`
		since = parseInt(since, 10);

		if (isNaN(since) || since > Date.now()) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.parallel({
			post: async.apply(Posts.getPostData, pid),
			diffs: async.apply(db.getSortedSetRangeByScore.bind(db), 'post:' + pid + ':diffs', 0, -1, since, Date.now()),
		}, function (err, data) {
			if (err) {
				return callback(err);
			}

			// Replace content with re-constructed content from that point in time
			data.post.content = data.diffs.reverse().reduce(function (content, diffString) {
				return diff.applyPatch(content, diffString);
			}, data.post.content);

			// Clear editor data (as it is outdated for this content)
			delete data.post.edited;
			data.post.editor = null;

			return callback(null, data.post);
		});
	};
};
