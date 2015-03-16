
'use strict';

var async = require('async'),
	topics = require('../topics');

module.exports = function(Posts) {

	Posts.getPostsByTid = function(tid, set, start, end, uid, reverse, callback) {
		Posts.getPidsFromSet(set, start, end, reverse, function(err, pids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(pids) || !pids.length) {
				return callback(null, []);
			}

			Posts.getPostsByPids(pids, uid, callback);
		});
	};

	Posts.isMain = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if (err) {
				return callback(err);
			}
			topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
				callback(err, parseInt(pid, 10) === parseInt(mainPid, 10));
			});
		});
	};

	Posts.getTopicFields = function(pid, fields, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if (err) {
				return callback(err);
			}

			topics.getTopicFields(tid, fields, callback);
		});
	};

};