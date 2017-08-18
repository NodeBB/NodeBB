'use strict';

var async = require('async');
var _ = require('lodash');
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
				next(null, {
					uid: uid,
					timestamp: timestamp,
					expiry: parseInt(expiry, 10),
					expiry_readable: new Date(parseInt(expiry, 10)).toString(),
					reason: validator.escape(String(reason)),
				});
			},
		], callback);
	};

	User.getModerationHistory = function (uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					flags: async.apply(db.getSortedSetRevRangeWithScores, 'flags:byTargetUid:' + uid, 0, 19),
					bans: async.apply(db.getSortedSetRevRangeWithScores, 'uid:' + uid + ':bans', 0, 19),
					reasons: async.apply(db.getSortedSetRevRangeWithScores, 'banned:' + uid + ':reasons', 0, 19),
				}, next);
			},
			function (data, next) {
				// Get pids from flag objects
				var keys = data.flags.map(function (flagObj) {
					return 'flag:' + flagObj.value;
				});
				db.getObjectsFields(keys, ['type', 'targetId'], function (err, payload) {
					if (err) {
						return next(err);
					}

					// Only pass on flag ids from posts
					data.flags = payload.reduce(function (memo, cur, idx) {
						if (cur.type === 'post') {
							memo.push({
								value: parseInt(cur.targetId, 10),
								score: data.flags[idx].score,
							});
						}

						return memo;
					}, []);

					getFlagMetadata(data, next);
				});
			},
			function (data, next) {
				formatBanData(data);
				next(null, data);
			},
		], callback);
	};

	User.getHistory = function (set, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRangeWithScores(set, 0, -1, next);
			},
			function (data, next) {
				next(null, data.map(function (set) {
					set.timestamp = set.score;
					set.timestampISO = utils.toISOString(set.score);
					set.value = validator.escape(String(set.value.split(':')[0]));
					delete set.score;
					return set;
				}));
			},
		], callback);
	};

	function getFlagMetadata(data, callback) {
		var pids = data.flags.map(function (flagObj) {
			return parseInt(flagObj.value, 10);
		});
		async.waterfall([
			function (next) {
				posts.getPostsFields(pids, ['tid'], next);
			},
			function (postData, next) {
				var tids = postData.map(function (post) {
					return post.tid;
				});

				topics.getTopicsFields(tids, ['title'], next);
			},
			function (topicData, next) {
				data.flags = data.flags.map(function (flagObj, idx) {
					flagObj.pid = flagObj.value;
					flagObj.timestamp = flagObj.score;
					flagObj.timestampISO = new Date(flagObj.score).toISOString();
					flagObj.timestampReadable = new Date(flagObj.score).toString();

					delete flagObj.value;
					delete flagObj.score;

					return _.extend(flagObj, topicData[idx]);
				});
				next(null, data);
			},
		], callback);
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
						data.note = validator.escape(String(data.note));
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
