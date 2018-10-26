'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var privileges = require('../privileges');


module.exports = function (Posts) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
	};

	Posts.getRecentPosts = function (uid, start, stop, term, callback) {
		var min = 0;
		if (terms[term]) {
			min = Date.now() - terms[term];
		}

		var count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;

		async.waterfall([
			function (next) {
				db.getSortedSetRevRangeByScore('posts:pid', start, count, '+inf', min, next);
			},
			function (pids, next) {
				privileges.posts.filter('read', pids, uid, next);
			},
			function (pids, next) {
				Posts.getPostSummaryByPids(pids, uid, { stripTags: true }, next);
			},
		], callback);
	};

	Posts.getRecentPosterUids = function (start, stop, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('posts:pid', start, stop, next);
			},
			function (pids, next) {
				Posts.getPostsFields(pids, ['uid'], next);
			},
			function (postData, next) {
				var uids = _.uniq(postData.map(post => post && post.uid).filter(uid => parseInt(uid, 10)));

				next(null, uids);
			},
		], callback);
	};
};
