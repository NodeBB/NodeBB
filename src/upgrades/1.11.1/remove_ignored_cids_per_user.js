'use strict';

const db = require('../../database');

const batch = require('../../batch');

module.exports = {
	name: 'Remove uid:<uid>:ignored:cids',
	timestamp: Date.UTC(2018, 11, 11),
	method: function (callback) {
		const { progress } = this;

		batch.processSortedSet('users:joindate', (uids, next) => {
			progress.incr(uids.length);
			const keys = uids.map(uid => `uid:${uid}:ignored:cids`);
			db.deleteAll(keys, next);
		}, {
			progress: this.progress,
			batch: 500,
		}, callback);
	},
};
