'use strict';


import async from 'async';
import winston from 'winston';
import db from '../../database';
import topics from '../../topics';
import * as batch from '../../batch';

export const obj = {
	name: 'Sorted set for pinned topics',
	timestamp: Date.UTC(2016, 10, 25),
	method: function (callback) {
		batch.processSortedSet('topics:tid', (ids, next) => {
			topics.getTopicsFields(ids, ['tid', 'cid', 'pinned', 'lastposttime'], (err, data) => {
				if (err) {
					return next(err);
				}

				data = data.filter(topicData => parseInt(topicData.pinned, 10) === 1);

				async.eachSeries(data, (topicData, next) => {
					winston.verbose(`processing tid: ${topicData.tid}`);

					async.parallel([
						async.apply(db.sortedSetAdd, `cid:${topicData.cid}:tids:pinned`, Date.now(), topicData.tid),
						async.apply(db.sortedSetRemove, `cid:${topicData.cid}:tids`, topicData.tid),
						async.apply(db.sortedSetRemove, `cid:${topicData.cid}:tids:posts`, topicData.tid),
					], next);
				}, next);
			});
		}, callback);
	},
};
