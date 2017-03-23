'use strict';

var async = require('async');
var _ = require('underscore');
var validator = require('validator');

var db = require('../database');
var posts = require('../posts');
var topics = require('../topics');
var utils = require('../../public/src/utils');

module.exports = function (User) {
	User.getLatestBanInfo = function (uid, callback) {
		// Simply retrieves the last record of the user's ban, even if they've been unbanned since then.
		var timestamp;
		var expiry;
		var reason;

		async.waterfall([
			async.apply(db.getSortedSetRevRangeWithScores, 'uid:' + uid + ':bans', 0, 0),
			function (record, next) {
				if (!record.length) {
					return next(new Error('no-ban-info'));
				}

				timestamp = record[0].score;
				expiry = record[0].value;

				db.getSortedSetRangeByScore('banned:' + uid + ':reasons', 0, -1, timestamp, timestamp, next);
			},
			function (_reason, next) {
				reason = _reason && _reason.length ? _reason[0] : '';
				next();
			},
		], function (err) {
			if (err) {
				return callback(err);
			}

			callback(null, {
				uid: uid,
				timestamp: timestamp,
				expiry: parseInt(expiry, 10),
				expiry_readable: new Date(parseInt(expiry, 10)).toString().replace(/:/g, '%3A'),
				reason: validator.escape(String(reason)),
			});
		});
	};

	User.getModerationHistory = function (uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					flags: async.apply(db.getSortedSetRevRangeWithScores, 'uid:' + uid + ':flag:pids', 0, 19),
					bans: async.apply(db.getSortedSetRevRangeWithScores, 'uid:' + uid + ':bans', 0, 19),
					reasons: async.apply(db.getSortedSetRevRangeWithScores, 'banned:' + uid + ':reasons', 0, 19),
				}, next);
			},
			function (data, next) {
				getFlagMetadata(data, next);
			},
		], function (err, data) {
			if (err) {
				return callback(err);
			}
			formatBanData(data);
			callback(null, data);
		});
	};

	User.getHistory = function (set, callback) {
		db.getSortedSetRevRangeWithScores(set, 0, -1, function (err, data) {
			if (err) {
				return callback(err);
			}
			callback(null, data.map(function (set) {
				set.timestamp = set.score;
				set.timestampISO = utils.toISOString(set.score);
				set.value = validator.escape(String(set.value.split(':')[0]));
				delete set.score;
				return set;
			}));
		});
	};

	function getFlagMetadata(data, callback) {
		var pids = data.flags.map(function (flagObj) {
			return parseInt(flagObj.value, 10);
		});

		posts.getPostsFields(pids, ['tid'], function (err, postData) {
			if (err) {
				return callback(err);
			}

			var tids = postData.map(function (post) {
				return post.tid;
			});

			topics.getTopicsFields(tids, ['title'], function (err, topicData) {
				if (err) {
					return callback(err);
				}
				data.flags = data.flags.map(function (flagObj, idx) {
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
		var reasons = data.reasons.reduce(function (memo, cur) {
			memo[cur.score] = cur.value;
			return memo;
		}, {});

		data.bans = data.bans.map(function (banObj) {
			banObj.until = parseInt(banObj.value, 10);
			banObj.untilReadable = new Date(banObj.until).toString();
			banObj.timestamp = parseInt(banObj.score, 10);
			banObj.timestampReadable = new Date(banObj.score).toString();
			banObj.timestampISO = new Date(banObj.score).toISOString();
			banObj.reason = validator.escape(String(reasons[banObj.score] || '')) || '[[user:info.banned-no-reason]]';

			delete banObj.value;
			delete banObj.score;
			delete data.reasons;

			return banObj;
		});
	}

	User.getModerationNotes = function (uid, start, stop, callback) {
		var noteData;
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('uid:' + uid + ':moderation:notes', start, stop, next);
			},
			function (notes, next) {
				var uids = [];
				noteData = notes.map(function (note) {
					try {
						var data = JSON.parse(note);
						uids.push(data.uid);
						data.timestampISO = utils.toISOString(data.timestamp);
						return data;
					} catch (err) {
						return next(err);
					}
				});

				User.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
			},
			function (userData, next) {
				noteData.forEach(function (note, index) {
					if (note) {
						note.user = userData[index];
					}
				});
				next(null, noteData);
			},
		], callback);
	};
};
