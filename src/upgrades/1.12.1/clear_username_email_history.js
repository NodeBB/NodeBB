'use strict';

const async = require('async');
const db = require('../../database');
const user = require('../../user');

module.exports = {
	name: 'Delete username email history for deleted users',
	timestamp: Date.UTC(2019, 2, 25),
	method: function (callback) {
		const progress = this.progress;
		var currentUid = 1;
		db.getObjectField('global', 'nextUid', function (err, nextUid) {
			if (err) {
				return callback(err);
			}
			progress.total = nextUid;
			async.whilst(function (next) {
				next(null, currentUid < nextUid);
			},
			function (next) {
				progress.incr();
				user.exists(currentUid, function (err, exists) {
					if (err) {
						return next(err);
					}
					if (exists) {
						currentUid += 1;
						return next();
					}
					db.deleteAll([`user:${currentUid}:usernames`, `user:${currentUid}:emails`], function (err) {
						if (err) {
							return next(err);
						}
						currentUid += 1;
						next();
					});
				});
			},
			function (err) {
				callback(err);
			});
		});
	},
};
