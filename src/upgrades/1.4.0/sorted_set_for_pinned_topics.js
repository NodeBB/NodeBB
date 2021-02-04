'use strict';


const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Sorted set for pinned topics',
	timestamp: Date.UTC(2016, 10, 25),
	method: function (callback) {
		const topics = require('../../topics');
		const batch = require('../../batch');
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
