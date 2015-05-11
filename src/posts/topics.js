
'use strict';

var async = require('async'),
	topics = require('../topics');

module.exports = function(Posts) {

	Posts.getPostsFromSet = function(set, start, stop, uid, reverse, callback) {
		async.waterfall([
			function(next) {
				Posts.getPidsFromSet(set, start, stop, reverse, next);
			},
			function(pids, next) {
				Posts.getPostsByPids(pids, uid, next);
			}
		], callback);
	};

	Posts.isMain = function(pid, callback) {
		async.waterfall([
			function(next) {
				Posts.getPostField(pid, 'tid', next);
			},
			function(tid, next) {
				topics.getTopicField(tid, 'mainPid', next);
			},
			function(mainPid, next) {
				next(null, parseInt(pid, 10) === parseInt(mainPid, 10));
			}
		], callback);
	};

	Posts.getTopicFields = function(pid, fields, callback) {
		async.waterfall([
			function(next) {
				Posts.getPostField(pid, 'tid', next);
			},
			function(tid, next) {
				topics.getTopicFields(tid, fields, next);
			}
		], callback);
	};

};