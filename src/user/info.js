'use strict';

var async = require('async');
var _ = require('lodash');
var validator = require('validator');

var db = require('../database');
var user = require('../user');
var posts = require('../posts');
var topics = require('../topics');
var utils = require('../../public/src/utils');

module.exports = function (User) {
	User.getLatestBanInfo = function (uid, callback) {
		// Simply retrieves the last record of the user's ban, even if they've been unbanned since then.
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange('uid:' + uid + ':bans:timestamp', 0, 0, next);
			},
			function (record, next) {
				if (!record.length) {
					return next(new Error('no-ban-info'));
				}
				db.getObject(record[0], next);
			},
			function (banInfo, next) {
				var expiry = banInfo.expire;

				next(null, {
					uid: uid,
					timestamp: banInfo.timestamp,
					expiry: parseInt(expiry, 10),
					expiry_readable: new Date(parseInt(expiry, 10)).toString(),
					reason: validator.escape(String(banInfo.reason || '')),
				});
			},
		], callback);
	};

	User.getModerationHistory = function (uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					flags: async.apply(db.getSortedSetRevRangeWithScores, 'flags:byTargetUid:' + uid, 0, 19),
					bans: async.apply(db.getSortedSetRevRange, 'uid:' + uid + ':bans:timestamp', 0, 19),
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
				formatBanData(data, next);
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

	function formatBanData(data, callback) {
		var banData;
		async.waterfall([
			function (next) {
				db.getObjects(data.bans, next);
			},
			function (_banData, next) {
				banData = _banData;
				var uids = banData.map(banData => banData.fromUid);

				user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
			},
			function (usersData, next) {
				data.bans = banData.map(function (banObj, index) {
					banObj.user = usersData[index];
					banObj.until = parseInt(banObj.expire, 10);
					banObj.untilReadable = new Date(banObj.until).toString();
					banObj.timestampReadable = new Date(banObj.timestamp).toString();
					banObj.timestampISO = utils.toISOString(banObj.timestamp);
					banObj.reason = validator.escape(String(banObj.reason || '')) || '[[user:info.banned-no-reason]]';
					return banObj;
				});
				next(null, data);
			},
		], callback);
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
