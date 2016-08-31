'use strict';

var async = require('async');
var _ = require('underscore');

var db = require('../database');
var posts = require('../posts');
var topics = require('../topics');

module.exports = function(User) {
	User.getModerationHistory = function(uid, callback) {
		async.waterfall([
			function(next) {
				async.parallel({
					flags: async.apply(db.getSortedSetRevRangeWithScores, 'uid:' + uid + ':flag:pids', 0, 19),
					bans: async.apply(db.getSortedSetRevRangeWithScores, 'uid:' + uid + ':bans', 0, 19),
					reasons: async.apply(db.getSortedSetRevRangeWithScores, 'banned:' + uid + ':reasons', 0, 19)
				}, next);
			},
			function(data, next) {
				getFlagMetadata(data, next);
			}
		], function(err, data) {
			if (err) {
				return callback(err);
			}
			formatBanData(data);
			callback(null, data);
		});
	};

	function getFlagMetadata(data, callback) {
		var pids = data.flags.map(function(flagObj) {
			return parseInt(flagObj.value, 10);
		});

		posts.getPostsFields(pids, ['tid'], function(err, postData) {
			if (err) {
				return callback(err);
			}

			var tids = postData.map(function(post) {
				return post.tid;
			});

			topics.getTopicsFields(tids, ['title'], function(err, topicData) {
				if (err) {
					return callback(err);
				}
				data.flags = data.flags.map(function(flagObj, idx) {
					flagObj.pid = flagObj.value;
					flagObj.timestamp = flagObj.score;
					flagObj.timestampISO = new Date(flagObj.score).toISOString();
					flagObj.timestampReadable = new Date(flagObj.score).toString();

					delete flagObj.value;
					delete flagObj.score;

					return _.extend(flagObj, topicData[idx]);
				});

				callback(null, data);
			});
		});
	}

	function formatBanData(data) {
		var reasons = data.reasons.reduce(function(memo, cur) {
				memo[cur.score] = cur.value;
				return memo;
			}, {});

		data.bans = data.bans.map(function(banObj) {
			banObj.until = parseInt(banObj.value, 10);
			banObj.untilReadable = new Date(banObj.until).toString();
			banObj.timestamp = parseInt(banObj.score, 10);
			banObj.timestampReadable = new Date(banObj.score).toString();
			banObj.timestampISO = new Date(banObj.score).toISOString();
			banObj.reason = reasons[banObj.score] || '[[user:info.banned-no-reason]]';

			delete banObj.value;
			delete banObj.score;
			delete data.reasons;

			return banObj;
		});
	}
};