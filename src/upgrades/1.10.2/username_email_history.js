'use strict';

var db = require('../../database');

var async = require('async');
var batch = require('../../batch');
var user = require('../../user');

module.exports = {
	name: 'Record first entry in username/email history',
	timestamp: Date.UTC(2018, 7, 28),
	method: function (callback) {
		const progress = this.progress;

		batch.processSortedSet('users:joindate', function (ids, next) {
			async.each(ids, function (uid, next) {
				async.parallel([
					function (next) {
						// Username
						async.waterfall([
							async.apply(db.sortedSetCard, 'user:' + uid + ':usernames'),
							(count, next) => {
								if (count > 0) {
									// User has changed their username before, no record of original username, skip.
									return setImmediate(next, null, null);
								}

								user.getUserFields(uid, ['username', 'joindate'], next);
							},
							(userdata, next) => {
								if (!userdata) {
									return setImmediate(next);
								}

								db.sortedSetAdd('user:' + uid + ':usernames', userdata.joindate, [userdata.username, userdata.joindate].join(':'), next);
							},
						], next);
					},
					function (next) {
						// Email
						async.waterfall([
							async.apply(db.sortedSetCard, 'user:' + uid + ':emails'),
							(count, next) => {
								if (count > 0) {
									// User has changed their email before, no record of original email, skip.
									return setImmediate(next, null, null);
								}

								user.getUserFields(uid, ['email', 'joindate'], next);
							},
							(userdata, next) => {
								if (!userdata) {
									return setImmediate(next);
								}

								db.sortedSetAdd('user:' + uid + ':emails', userdata.joindate, [userdata.email, userdata.joindate].join(':'), next);
							},
						], next);
					},
				], function (err) {
					progress.incr();
					setImmediate(next, err);
				});
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
