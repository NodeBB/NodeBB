'use strict';


import async from 'async';
import winston from 'winston';
import db from '../../database';
import posts from '../../posts';
import * as batch from '../../batch';

export const obj = {
	name: 'Sorted sets for post replies',
	timestamp: Date.UTC(2016, 9, 14),
	method: function (callback) {
		const { progress } = this;

		batch.processSortedSet('posts:pid', (ids, next) => {
			posts.getPostsFields(ids, ['pid', 'toPid', 'timestamp'], (err, data) => {
				if (err) {
					return next(err);
				}

				progress.incr();

				async.eachSeries(data, (postData, next) => {
					if (!parseInt(postData.toPid, 10)) {
						return next(null);
					}
					winston.verbose(`processing pid: ${postData.pid} toPid: ${postData.toPid}`);
					async.parallel([
						async.apply(db.sortedSetAdd, `pid:${postData.toPid}:replies`, postData.timestamp, postData.pid),
						async.apply(db.incrObjectField, `post:${postData.toPid}`, 'replies'),
					], next);
				}, next);
			});
		}, {
			progress: progress,
		}, callback);
	},
};
