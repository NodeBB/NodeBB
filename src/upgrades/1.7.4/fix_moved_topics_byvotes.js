'use strict';

const async = require('async');
const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Fix sort by votes for moved topics',
	timestamp: Date.UTC(2018, 0, 8),
	method: function (callback) {
		const { progress } = this;

		batch.processSortedSet('topics:tid', (tids, next) => {
			async.eachLimit(tids, 500, (tid, _next) => {
				progress.incr();
				let topicData;
				async.waterfall([
					function (next) {
						db.getObjectFields(`topic:${tid}`, ['cid', 'oldCid', 'upvotes', 'downvotes', 'pinned'], next);
					},
					function (_topicData, next) {
						topicData = _topicData;
						if (!topicData.cid || !topicData.oldCid) {
							return _next();
						}

						const upvotes = parseInt(topicData.upvotes, 10) || 0;
						const downvotes = parseInt(topicData.downvotes, 10) || 0;
						const votes = upvotes - downvotes;

						async.series([
							function (next) {
								db.sortedSetRemove(`cid:${topicData.oldCid}:tids:votes`, tid, next);
							},
							function (next) {
								if (parseInt(topicData.pinned, 10) !== 1) {
									db.sortedSetAdd(`cid:${topicData.cid}:tids:votes`, votes, tid, next);
								} else {
									next();
								}
							},
						], (err) => {
							next(err);
						});
					},
				], _next);
			}, next);
		}, {
			progress: progress,
			batch: 500,
		}, callback);
	},
};
