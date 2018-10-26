'use strict';

var async = require('async');
var validator = require('validator');
var diff = require('diff');

var db = require('../database');
var meta = require('../meta');
var plugins = require('../plugins');
var translator = require('../translator');

var Diffs = {};

Diffs.exists = function (pid, callback) {
	if (meta.config.enablePostHistory !== 1) {
		return callback(null, 0);
	}

	db.listLength('post:' + pid + ':diffs', function (err, numDiffs) {
		return callback(err, !!numDiffs);
	});
};

Diffs.get = function (pid, since, callback) {
	async.waterfall([
		function (next) {
			Diffs.list(pid, next);
		},
		function (timestamps, next) {
			// Pass those made after `since`, and create keys
			const keys = timestamps.filter(function (timestamp) {
				return (parseInt(timestamp, 10) || 0) >= since;
			}).map(function (timestamp) {
				return 'diff:' + pid + '.' + timestamp;
			});

			db.getObjects(keys, next);
		},
	], callback);
};

Diffs.list = function (pid, callback) {
	db.getListRange('post:' + pid + ':diffs', 0, -1, callback);
};

Diffs.save = function (pid, oldContent, newContent, callback) {
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

Diffs.load = function (pid, since, uid, callback) {
	var Posts = require('../posts');

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

		postDiffLoad(data);

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

function postDiffLoad(data) {
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
}

module.exports = function (Posts) {
	Posts.diffs = {};

	Object.keys(Diffs).forEach(function (property) {
		Posts.diffs[property] = Diffs[property];
	});
};
