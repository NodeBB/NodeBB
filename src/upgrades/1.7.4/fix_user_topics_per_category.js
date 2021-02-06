'use strict';

const async = require('async');
const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Fix topics in categories per user if they were moved',
	timestamp: Date.UTC(2018, 0, 22),
	method: function (callback) {
		const { progress } = this;

		batch.processSortedSet('topics:tid', (tids, next) => {
			async.eachLimit(tids, 500, (tid, _next) => {
				progress.incr();
				let topicData;
				async.waterfall([
					function (next) {
						db.getObjectFields(`topic:${tid}`, ['cid', 'tid', 'uid', 'oldCid', 'timestamp'], next);
					},
					function (_topicData, next) {
						topicData = _topicData;
						if (!topicData.cid || !topicData.oldCid) {
							return _next();
						}

						db.isSortedSetMember(`cid:${topicData.oldCid}:uid:${topicData.uid}`, topicData.tid, next);
					},
					function (isMember, next) {
						if (isMember) {
							async.series([
								function (next) {
									db.sortedSetRemove(`cid:${topicData.oldCid}:uid:${topicData.uid}:tids`, tid, next);
								},
								function (next) {
									db.sortedSetAdd(`cid:${topicData.cid}:uid:${topicData.uid}:tids`, topicData.timestamp, tid, next);
								},
							], (err) => {
								next(err);
							});
						} else {
							next();
						}
					},
				], _next);
			}, next);
		}, {
			progress: progress,
			batch: 500,
		}, callback);
	},
};
