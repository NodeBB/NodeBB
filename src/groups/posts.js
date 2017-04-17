'use strict';

var async = require('async');

var db = require('../database');
var privileges = require('../privileges');
var posts = require('../posts');

module.exports = function (Groups) {
	Groups.getLatestMemberPosts = function (groupName, max, uid, callback) {
		async.waterfall([
			function (next) {
				Groups.getMembers(groupName, 0, -1, next);
			},
			function (uids, next) {
				if (!Array.isArray(uids) || !uids.length) {
					return callback(null, []);
				}
				var keys = uids.map(function (uid) {
					return 'uid:' + uid + ':posts';
				});
				db.getSortedSetRevRange(keys, 0, max - 1, next);
			},
			function (pids, next) {
				privileges.posts.filter('read', pids, uid, next);
			},
			function (pids, next) {
				posts.getPostSummaryByPids(pids, uid, { stripTags: false }, next);
			},
		], callback);
	};
};
