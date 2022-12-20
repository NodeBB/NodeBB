'use strict';


import async from 'async';
import winston from 'winston';
import db from '../../database';
import * as batch from '../../batch';
import topics from '../../topics';

export const obj = {
	name: 'Users post count per tid',
	timestamp: Date.UTC(2016, 3, 19),
	method: function (callback) {
		let count = 0;
		batch.processSortedSet('topics:tid', (tids, next) => {
			winston.verbose(`upgraded ${count} topics`);
			count += tids.length;
			async.each(tids, (tid, next) => {
				db.delete(`tid:${tid}:posters`, (err) => {
					if (err) {
						return next(err);
					}
					topics.getPids(tid, (err, pids) => {
						if (err) {
							return next(err);
						}

						if (!pids.length) {
							return next();
						}

						async.eachSeries(pids, (pid, next) => {
							db.getObjectField(`post:${pid}`, 'uid', (err, uid) => {
								if (err) {
									return next(err);
								}
								if (!parseInt(uid, 10)) {
									return next();
								}
								db.sortedSetIncrBy(`tid:${tid}:posters`, 1, uid, next);
							});
						}, next);
					});
				});
			}, next);
		}, {}, callback);
	},
};
