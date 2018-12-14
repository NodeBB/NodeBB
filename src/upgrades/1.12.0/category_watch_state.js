'use strict';

var async = require('async');

var db = require('../../database');
var batch = require('../../batch');
var categories = require('../../categories');

module.exports = {
	name: 'Update category watch data',
	timestamp: Date.UTC(2018, 11, 13),
	method: function (callback) {
		const progress = this.progress;
		let keys;
		async.waterfall([
			function (next) {
				db.getSortedSetRange('categories:cid', 0, -1, next);
			},
			function (cids, next) {
				keys = cids.map(cid => 'cid:' + cid + ':ignorers');
				batch.processSortedSet('users:joindate', function (uids, next) {
					progress.incr(uids.length);

					async.eachSeries(cids, function (cid, next) {
						db.isSortedSetMembers('cid:' + cid + ':ignorers', uids, function (err, isMembers) {
							if (err) {
								return next(err);
							}
							uids = uids.filter((uid, index) => isMembers[index]);
							if (!uids.length) {
								return setImmediate(next);
							}
							const states = uids.map(() => categories.watchStates.ignoring);
							db.sortedSetAdd('cid:' + cid + ':uid:watch:state', states, uids, next);
						});
					}, next);
				}, {
					progress: progress,
				}, next);
			},
			function (next) {
				db.deleteAll(keys, next);
			},
		], callback);
	},
};
