'use strict';

const db = require('../../database');
const batch = require('../../batch');

module.exports = {
	name: 'Clean up old notifications',
	timestamp: Date.UTC(2019, 9, 7),
	method: async function (callback) {
		const progress = this.progress;
		const week = 604800000;
		const cutoffTime = Date.now() - week;
		await batch.processSortedSet('users:joindate', async function (uids) {
			progress.incr(uids.length);
			await Promise.all([
				db.sortedSetsRemoveRangeByScore(uids.map(uid => 'uid:' + uid + ':notifications:unread'), '-inf', cutoffTime),
				db.sortedSetsRemoveRangeByScore(uids.map(uid => 'uid:' + uid + ':notifications:read'), '-inf', cutoffTime),
			]);
		}, {
			batch: 500,
			progress: progress,
		});
		callback();
	},
};
