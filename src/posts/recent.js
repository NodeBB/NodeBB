'use strict';

var db = require('../database'),
	privileges = require('../privileges');


module.exports = function(Posts) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000
	};

	Posts.getRecentPosts = function(uid, start, stop, term, callback) {
		var since = terms.day;
		if (terms[term]) {
			since = terms[term];
		}

		var count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;

		db.getSortedSetRevRangeByScore('posts:pid', start, count, Infinity, Date.now() - since, function(err, pids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(pids) || !pids.length) {
				return callback(null, []);
			}

			privileges.posts.filter('read', pids, uid, function(err, pids) {
				if (err) {
					return callback(err);
				}
				Posts.getPostSummaryByPids(pids, uid, {stripTags: true}, callback);
			});
		});
	};

	Posts.getRecentPosterUids = function(start, end, callback) {
		db.getSortedSetRevRange('posts:pid', start, end, function(err, pids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(pids) || !pids.length) {
				return callback(null, []);
			}

			pids = pids.map(function(pid) {
				return 'post:' + pid;
			});

			db.getObjectsFields(pids, ['uid'], function(err, postData) {
				if (err) {
					return callback(err);
				}

				postData = postData.map(function(post) {
					return post && post.uid;
				}).filter(function(value, index, array) {
					return value && array.indexOf(value) === index;
				});

				callback(null, postData);
			});
		});
	};

};
