'use strict';


const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Sorted sets for post replies',
	timestamp: Date.UTC(2016, 9, 14),
	method: function (callback) {
		const posts = require('../../posts');
		const batch = require('../../batch');
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
