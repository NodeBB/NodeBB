'use strict';

var async = require('async'),
	posts = require('../posts'),
	db = require('../database');

module.exports = function(Categories) {

	Categories.getActiveUsers = function(cid, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange('cid:' + cid + ':pids', 0, 24, next);
			},
			function(pids, next) {
				posts.getPostsFields(pids, ['uid'], next);
			},
			function(posts, next) {
				var uids = posts.map(function(post) {
					return post.uid;
				}).filter(function(uid, index, array) {
					return parseInt(uid, 10) !== 0 && array.indexOf(uid) === index;
				}).slice(0, 24);

				next(null, uids);
			}
		], callback);
	};
};
