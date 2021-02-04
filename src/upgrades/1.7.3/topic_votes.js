'use strict';

const async = require('async');
const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Add votes to topics',
	timestamp: Date.UTC(2017, 11, 8),
	method: function (callback) {
		const progress = this.progress;

		batch.processSortedSet('topics:tid', (tids, next) => {
			async.eachLimit(tids, 500, (tid, _next) => {
				progress.incr();
				let topicData;
				async.waterfall([
					function (next) {
						db.getObjectFields(`topic:${tid}`, ['mainPid', 'cid', 'pinned'], next);
					},
					function (_topicData, next) {
						topicData = _topicData;
						if (!topicData.mainPid || !topicData.cid) {
							return _next();
						}
						db.getObject(`post:${topicData.mainPid}`, next);
					},
					function (postData, next) {
						if (!postData) {
							return _next();
						}
						const upvotes = parseInt(postData.upvotes, 10) || 0;
						const downvotes = parseInt(postData.downvotes, 10) || 0;
						const data = {
							upvotes: upvotes,
							downvotes: downvotes,
						};
						const votes = upvotes - downvotes;
						async.parallel([
							function (next) {
								db.setObject(`topic:${tid}`, data, next);
							},
							function (next) {
								db.sortedSetAdd('topics:votes', votes, tid, next);
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
