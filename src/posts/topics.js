
'use strict';

var async = require('async');

var topics = require('../topics');
var utils = require('../utils');

module.exports = function (Posts) {
	Posts.getPostsFromSet = function (set, start, stop, uid, reverse, callback) {
		async.waterfall([
			function (next) {
				Posts.getPidsFromSet(set, start, stop, reverse, next);
			},
			function (pids, next) {
				Posts.getPostsByPids(pids, uid, next);
			},
		], callback);
	};

	Posts.isMain = function (pid, callback) {
		async.waterfall([
			function (next) {
				Posts.getPostField(pid, 'tid', next);
			},
			function (tid, next) {
				topics.getTopicField(tid, 'mainPid', next);
			},
			function (mainPid, next) {
				next(null, parseInt(pid, 10) === parseInt(mainPid, 10));
			},
		], callback);
	};

	Posts.getTopicFields = function (pid, fields, callback) {
		async.waterfall([
			function (next) {
				Posts.getPostField(pid, 'tid', next);
			},
			function (tid, next) {
				topics.getTopicFields(tid, fields, next);
			},
		], callback);
	};

	Posts.generatePostPath = function (pid, uid, callback) {
		Posts.generatePostPaths([pid], uid, function (err, paths) {
			callback(err, Array.isArray(paths) && paths.length ? paths[0] : null);
		});
	};

	Posts.generatePostPaths = function (pids, uid, callback) {
		async.waterfall([
			function (next) {
				Posts.getPostsFields(pids, ['pid', 'tid'], next);
			},
			function (postData, next) {
				async.parallel({
					indices: function (next) {
						Posts.getPostIndices(postData, uid, next);
					},
					topics: function (next) {
						var tids = postData.map(function (post) {
							return post ? post.tid : null;
						});

						topics.getTopicsFields(tids, ['slug'], next);
					},
				}, next);
			},
			function (results, next) {
				var paths = pids.map(function (pid, index) {
					var slug = results.topics[index] ? results.topics[index].slug : null;
					var postIndex = utils.isNumber(results.indices[index]) ? parseInt(results.indices[index], 10) + 1 : null;

					if (slug && postIndex) {
						return '/topic/' + slug + '/' + postIndex;
					}
					return null;
				});

				next(null, paths);
			},
		], callback);
	};
};
