'use strict';

var async = require('async');

var db = require('../database');
var privileges = require('../privileges');
var posts = require('../posts');

module.exports = function (Groups) {
	Groups.onNewPostMade = function (postData, callback) {
		if (!parseInt(postData.uid, 10)) {
			return setImmediate(callback);
		}

		var groupNames;
		async.waterfall([
			function (next) {
				Groups.getUserGroupMembership('groups:visible:createtime', [postData.uid], next);
			},
			function (_groupNames, next) {
				groupNames = _groupNames[0];

				var keys = groupNames.map(function (groupName) {
					return 'group:' + groupName + ':member:pids';
				});

				db.sortedSetsAdd(keys, postData.timestamp, postData.pid, next);
			},
			function (next) {
				async.each(groupNames, function (groupName, next) {
					truncateMemberPosts(groupName, next);
				}, next);
			},
		], callback);
	};

	function truncateMemberPosts(groupName, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('group:' + groupName + ':member:pids', 10, 10, next);
			},
			function (lastPid, next) {
				lastPid = lastPid[0];
				if (!parseInt(lastPid, 10)) {
					return callback();
				}
				db.sortedSetScore('group:' + groupName + ':member:pids', lastPid, next);
			},
			function (score, next) {
				db.sortedSetsRemoveRangeByScore(['group:' + groupName + ':member:pids'], '-inf', score, next);
			},
		], callback);
	}

	Groups.getLatestMemberPosts = function (groupName, max, uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('group:' + groupName + ':member:pids', 0, max - 1, next);
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
