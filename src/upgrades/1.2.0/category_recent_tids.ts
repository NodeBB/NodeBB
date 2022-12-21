'use strict';

const async = require('async');
const db = require('../../database');


module.exports = {
	name: 'Category recent tids',
	timestamp: Date.UTC(2016, 8, 22),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, (err, cids) => {
			if (err) {
				return callback(err);
			}

			async.eachSeries(cids, (cid, next) => {
				db.getSortedSetRevRange(`cid:${cid}:pids`, 0, 0, (err, pid) => {
					if (err || !pid) {
						return next(err);
					}
					db.getObjectFields(`post:${pid}`, ['tid', 'timestamp'], (err, postData) => {
						if (err || !postData || !postData.tid) {
							return next(err);
						}
						db.sortedSetAdd(`cid:${cid}:recent_tids`, postData.timestamp, postData.tid, next);
					});
				});
			}, callback);
		});
	},
};
