'use strict';

const async = require('async');
const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Reformatting post diffs to be stored in lists and hash instead of single zset',
	timestamp: Date.UTC(2018, 2, 15),
	method: function (callback) {
		const { progress } = this;

		batch.processSortedSet('posts:pid', (pids, next) => {
			async.each(pids, (pid, next) => {
				db.getSortedSetRangeWithScores(`post:${pid}:diffs`, 0, -1, (err, diffs) => {
					if (err) {
						return next(err);
					}

					if (!diffs || !diffs.length) {
						progress.incr();
						return next();
					}

					// For each diff, push to list
					async.each(diffs, (diff, next) => {
						async.series([
							async.apply(db.delete.bind(db), `post:${pid}:diffs`),
							async.apply(db.listPrepend.bind(db), `post:${pid}:diffs`, diff.score),
							async.apply(db.setObject.bind(db), `diff:${pid}.${diff.score}`, {
								pid: pid,
								patch: diff.value,
							}),
						], next);
					}, (err) => {
						if (err) {
							return next(err);
						}

						progress.incr();
						return next();
					});
				});
			}, (err) => {
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
