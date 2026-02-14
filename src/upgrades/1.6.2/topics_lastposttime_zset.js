'use strict';

const async = require('async');

const db = require('../../database');

module.exports = {
	name: 'New sorted set cid:<cid>:tids:lastposttime',
	timestamp: Date.UTC(2017, 9, 30),
	method: function (callback) {
		const { progress } = this;

		require('../../batch').processSortedSet('topics:tid', (tids, next) => {
			async.eachSeries(tids, (tid, next) => {
				db.getObjectFields(`topic:${tid}`, ['cid', 'timestamp', 'lastposttime'], (err, topicData) => {
					if (err || !topicData) {
						return next(err);
					}
					progress.incr();

					const timestamp = topicData.lastposttime || topicData.timestamp || Date.now();
					db.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, timestamp, tid, next);
				}, next);
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
