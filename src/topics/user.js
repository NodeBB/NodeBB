

'use strict';

var async = require('async'),
	db = require('../database'),
	posts = require('../posts');


module.exports = function(Topics) {

	Topics.isOwner = function(tid, uid, callback) {
		uid = parseInt(uid, 10);
		if (!uid) {
			return callback(null, false);
		}
		Topics.getTopicField(tid, 'uid', function(err, author) {
			callback(err, parseInt(author, 10) === uid);
		});
	};

	Topics.getUids = function(tid, callback) {
		async.waterfall([
			function(next) {
				Topics.getPids(tid, next);
			},
			function(pids, next) {
				posts.getPostsFields(pids, ['uid'], next);
			},
			function(postData, next) {
				var uids = postData.map(function(post) {
					return post && post.uid;
				}).filter(function(uid, index, array) {
					return uid && array.indexOf(uid) === index;
				});

				next(null, uids);
			}
		], callback);
	};
};