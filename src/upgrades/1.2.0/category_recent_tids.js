'use strict';

var async = require('async');
var db = require('../../database');


module.exports = {
	name: 'Category recent tids',
	timestamp: Date.UTC(2016, 8, 22),
	method: function (callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
			if (err) {
				return callback(err);
			}

			async.eachSeries(cids, function (cid, next) {
				db.getSortedSetRevRange('cid:' + cid + ':pids', 0, 0, function (err, pid) {
					if (err || !pid) {
						return next(err);
					}
					db.getObjectFields('post:' + pid, ['tid', 'timestamp'], function (err, postData) {
						if (err || !postData || !postData.tid) {
							return next(err);
						}
						db.sortedSetAdd('cid:' + cid + ':recent_tids', postData.timestamp, postData.tid, next);
					});
				});
			}, callback);
		});
	},
};
