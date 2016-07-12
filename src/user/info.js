'use strict';

var async = require('async'),
	_ = require('underscore');

var db = require('../database'),
	posts = require('../posts'),
	topics = require('../topics');

module.exports = function(User) {
	User.getModerationHistory = function(uid, callback) {
		async.waterfall([
			function(next) {
				async.parallel({
					flags: async.apply(db.getSortedSetRevRangeByScoreWithScores, 'uid:' + uid + ':flag:pids', 0, 20, '+inf', '-inf'),
					bans: async.apply(db.getSortedSetRevRangeByScoreWithScores, 'uid:' + uid + ':bans', 0, 20, '+inf', '-inf')
				}, next);
			},
			async.apply(getFlagMetadata),
			async.apply(formatBanData)
		], function(err, data) {
			callback(err, data);
		});
	};

	function getFlagMetadata(data, callback) {
		// Retrieve post title & slug from flags list
		posts.getPostsFields(data.flags.map(function(flagObj) {
			return parseInt(flagObj.value, 10);
		}), ['tid'], function(err, postData) {
			if (err) {
				return callback(err);
			}

			var tids = postData.map(function(post) {
				return post.tid;
			});

			topics.getTopicsFields(tids, ['title'], function(err, topicData) {
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

	function formatBanData(data, callback) {
		data.bans = data.bans.map(function(banObj) {
			banObj.until = parseInt(banObj.value, 10);
			banObj.untilReadable = new Date(banObj.until).toString();
			banObj.timestamp = parseInt(banObj.score, 10);
			banObj.timestampReadable = new Date(banObj.score).toString();
			banObj.timestampISO = new Date(banObj.score).toISOString();

			delete banObj.value;
			delete banObj.score;

			return banObj;
		});

		setImmediate(callback, null, data);
	}
}