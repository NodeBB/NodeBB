'use strict';


var async = require('async');
var winston = require('winston');
var db = require('../../database');

module.exports = {
	name: 'Users post count per tid',
	timestamp: Date.UTC(2016, 3, 19),
	method: function (callback) {
		var batch = require('../../batch');
		var topics = require('../../topics');
		var count = 0;
		batch.processSortedSet('topics:tid', function (tids, next) {
			winston.verbose('upgraded ' + count + ' topics');
			count += tids.length;
			async.each(tids, function (tid, next) {
				db.delete('tid:' + tid + ':posters', function (err) {
					if (err) {
						return next(err);
					}
					topics.getPids(tid, function (err, pids) {
						if (err) {
							return next(err);
						}

						if (!pids.length) {
							return next();
						}

						async.eachSeries(pids, function (pid, next) {
							db.getObjectField('post:' + pid, 'uid', function (err, uid) {
								if (err) {
									return next(err);
								}
								if (!parseInt(uid, 10)) {
									return next();
								}
								db.sortedSetIncrBy('tid:' + tid + ':posters', 1, uid, next);
							});
						}, next);
					});
				});
			}, next);
		}, {}, callback);
	},
};
