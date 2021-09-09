'use strict';

var async = require('async');
var db = require('../../database');

var batch = require('../../batch');
// var user = require('../../user');

module.exports = {
	name: 'Upgrade bans to hashes',
	timestamp: Date.UTC(2018, 8, 24),
	method: function (callback) {
		const progress = this.progress;

		batch.processSortedSet('users:joindate', function (uids, next) {
			async.eachSeries(uids, function (uid, next) {
				progress.incr();

				async.parallel({
					bans: function (next) {
						db.getSortedSetRevRangeWithScores('uid:' + uid + ':bans', 0, -1, next);
					},
					reasons: function (next) {
						db.getSortedSetRevRangeWithScores('banned:' + uid + ':reasons', 0, -1, next);
					},
					userData: function (next) {
						db.getObjectFields('user:' + uid, ['banned', 'banned:expire', 'joindate', 'lastposttime', 'lastonline'], next);
					},
				}, function (err, results) {
					function addBan(key, data, callback) {
						async.waterfall([
							function (next) {
								db.setObject(key, data, next);
							},
							function (next) {
								db.sortedSetAdd('uid:' + uid + ':bans:timestamp', data.timestamp, key, next);
							},
						], callback);
					}
					if (err) {
						return next(err);
					}
					// has no ban history and isn't banned, skip
					if (!results.bans.length && !parseInt(results.userData.banned, 10)) {
						return next();
					}

					// has no history, but is banned, create plain object with just uid and timestmap
					if (!results.bans.length && parseInt(results.userData.banned, 10)) {
						const banTimestamp = results.userData.lastonline || results.userData.lastposttime || results.userData.joindate || Date.now();
						const banKey = 'uid:' + uid + ':ban:' + banTimestamp;
						addBan(banKey, { uid: uid, timestamp: banTimestamp }, next);
						return;
					}

					// process ban history
					async.eachSeries(results.bans, function (ban, next) {
						function findReason(score) {
							return results.reasons.find(function (reasonData) {
								return reasonData.score === score;
							});
						}
						const reasonData = findReason(ban.score);
						const banKey = 'uid:' + uid + ':ban:' + ban.score;
						var data = {
							uid: uid,
							timestamp: ban.score,
							expire: parseInt(ban.value, 10),
						};
						if (reasonData) {
							data.reason = reasonData.value;
						}
						addBan(banKey, data, next);
					}, function (err) {
						next(err);
					});
				});
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
