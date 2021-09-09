'use strict';

var async = require('async');
var db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Reformatting post diffs to be stored in lists and hash instead of single zset',
	timestamp: Date.UTC(2018, 2, 15),
	method: function (callback) {
		var progress = this.progress;

		batch.processSortedSet('posts:pid', function (pids, next) {
			async.each(pids, function (pid, next) {
				db.getSortedSetRangeWithScores('post:' + pid + ':diffs', 0, -1, function (err, diffs) {
					if (err) {
						return next(err);
					}

					if (!diffs || !diffs.length) {
						progress.incr();
						return next();
					}

					// For each diff, push to list
					async.each(diffs, function (diff, next) {
						async.series([
							async.apply(db.delete.bind(db), 'post:' + pid + ':diffs'),
							async.apply(db.listPrepend.bind(db), 'post:' + pid + ':diffs', diff.score),
							async.apply(db.setObject.bind(db), 'diff:' + pid + '.' + diff.score, {
								pid: pid,
								patch: diff.value,
							}),
						], next);
					}, function (err) {
						if (err) {
							return next(err);
						}

						progress.incr();
						return next();
					});
				});
			}, function (err) {
				if (err) {
					// Probably type error, ok to incr and continue
					progress.incr();
				}

				return next();
			});
		}, {
			progress: progress,
		}, callback);
	},
};
