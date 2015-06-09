

'use strict';

var db = require('../database'),
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
		Topics.getPids(tid, function(err, pids) {
			if (err) {
				return callback(err);
			}

			posts.getPostsFields(pids, ['uid'], function(err, postData) {
				if (err) {
					return callback(err);
				}

				var uids = postData.map(function(post) {
					return post && post.uid;
				}).filter(function(uid, index, array) {
					return array.indexOf(uid) === index;
				});

				callback(null, uids);
			});
		});
	};
};