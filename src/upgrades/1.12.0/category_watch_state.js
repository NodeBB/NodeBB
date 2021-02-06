'use strict';

const async = require('async');

const db = require('../../database');
const batch = require('../../batch');
const categories = require('../../categories');

module.exports = {
	name: 'Update category watch data',
	timestamp: Date.UTC(2018, 11, 13),
	method: function (callback) {
		const { progress } = this;
		let keys;
		async.waterfall([
			function (next) {
				db.getSortedSetRange('categories:cid', 0, -1, next);
			},
			function (cids, next) {
				keys = cids.map(cid => `cid:${cid}:ignorers`);
				batch.processSortedSet('users:joindate', (uids, next) => {
					progress.incr(uids.length);

					async.eachSeries(cids, (cid, next) => {
						db.isSortedSetMembers(`cid:${cid}:ignorers`, uids, (err, isMembers) => {
							if (err) {
								return next(err);
							}
							uids = uids.filter((uid, index) => isMembers[index]);
							if (!uids.length) {
								return setImmediate(next);
							}
							const states = uids.map(() => categories.watchStates.ignoring);
							db.sortedSetAdd(`cid:${cid}:uid:watch:state`, states, uids, next);
						});
					}, next);
				}, {
					progress: progress,
					batch: 500,
				}, next);
			},
			function (next) {
				db.deleteAll(keys, next);
			},
		], callback);
	},
};
