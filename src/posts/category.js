
'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var topics = require('../topics');

module.exports = function (Posts) {
	Posts.getCidByPid = function (pid, callback) {
		async.waterfall([
			function (next) {
				Posts.getPostField(pid, 'tid', next);
			},
			function (tid, next) {
				topics.getTopicField(tid, 'cid', next);
			},
		], callback);
	};

	Posts.getCidsByPids = function (pids, callback) {
		var tids;
		var postData;
		async.waterfall([
			function (next) {
				Posts.getPostsFields(pids, ['tid'], next);
			},
			function (_postData, next) {
				postData = _postData;
				tids = _.uniq(postData.map(function (post) {
					return post && post.tid;
				}).filter(Boolean));

				topics.getTopicsFields(tids, ['cid'], next);
			},
			function (topicData, next) {
				var map = {};
				topicData.forEach(function (topic, index) {
					if (topic) {
						map[tids[index]] = topic.cid;
					}
				});

				var cids = postData.map(function (post) {
					return map[post.tid];
				});
				next(null, cids);
			},
		], callback);
	};

	Posts.filterPidsByCid = function (pids, cid, callback) {
		if (!cid) {
			return setImmediate(callback, null, pids);
		}

		if (!Array.isArray(cid) || cid.length === 1) {
			return filterPidsBySingleCid(pids, cid, callback);
		}

		async.waterfall([
			function (next) {
				async.map(cid, function (cid, next) {
					Posts.filterPidsByCid(pids, cid, next);
				}, next);
			},
			function (pidsArr, next) {
				next(null, _.union.apply(_, pidsArr));
			},
		], callback);
	};

	function filterPidsBySingleCid(pids, cid, callback) {
		async.waterfall([
			function (next) {
				db.isSortedSetMembers('cid:' + parseInt(cid, 10) + ':pids', pids, next);
			},
			function (isMembers, next) {
				pids = pids.filter(function (pid, index) {
					return pid && isMembers[index];
				});
				next(null, pids);
			},
		], callback);
	}
};
