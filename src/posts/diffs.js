'use strict';

var async = require('async');
var validator = require('validator');
var diff = require('diff');

var db = require('../database');
var plugins = require('../plugins');
var translator = require('../translator');

module.exports = function (Posts) {
	Posts.diffs = {};

	Posts.diffs.exists = function (pid, callback) {
		db.listLength('post:' + pid + ':diffs', function (err, numDiffs) {
			return callback(err, !!numDiffs);
		});
	};

	Posts.diffs.get = function (pid, since, callback) {
		async.waterfall([
			async.apply(db.getListRange.bind(db), 'post:' + pid + ':diffs', 0, -1),
			function (timestamps, next) {
				// Pass those made after `since`, and create keys
				const keys = timestamps.filter(function (timestamp) {
					return (parseInt(timestamp, 10) || 0) > since;
				}).map(function (timestamp) {
					return 'diff:' + pid + '.' + timestamp;
				});

				db.getObjects(keys, next);
			},
		], callback);
	};

	Posts.diffs.list = function (pid, callback) {
		db.getListRange('post:' + pid + ':diffs', 0, -1, callback);
	};

	Posts.diffs.save = function (pid, oldContent, newContent, callback) {
		const now = Date.now();
		const patch = diff.createPatch('', newContent, oldContent);
		async.parallel([
			async.apply(db.listPrepend.bind(db), 'post:' + pid + ':diffs', now),
			async.apply(db.setObject.bind(db), 'diff:' + pid + '.' + now, {
				pid: pid,
				patch: patch,
			}),
		], function (err) {
			// No return arguments passed back
			callback(err);
		});
	};

	Posts.diffs.load = function (pid, since, uid, callback) {
		// Retrieves all diffs made since `since` and replays them to reconstruct what the post looked like at `since`
		since = parseInt(since, 10);

		if (isNaN(since) || since > Date.now()) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.parallel({
			post: async.apply(Posts.getPostSummaryByPids, [pid], uid, {
				parse: false,
			}),
			diffs: async.apply(Posts.diffs.get, pid, since),
		}, function (err, data) {
			if (err) {
				return callback(err);
			}

			data.post = data.post[0];
			data.post.content = validator.unescape(data.post.content);

			// Replace content with re-constructed content from that point in time
			data.post.content = data.diffs.reduce(function (content, currentDiff) {
				return diff.applyPatch(content, currentDiff.patch, {
					fuzzFactor: 1,
				});
			}, data.post.content);

			// Clear editor data (as it is outdated for this content)
			delete data.post.edited;
			data.post.editor = null;

			data.post.content = String(data.post.content || '');

			async.waterfall([
				function (next) {
					plugins.fireHook('filter:parse.post', { postData: data.post }, next);
				},
				function (data, next) {
					data.postData.content = translator.escape(data.postData.content);
					next(null, data.postData);
				},
			], callback);
		});
	};
};
