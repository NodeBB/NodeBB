'use strict';


var async = require('async');
var winston = require('winston');
var db = require('../../database');

module.exports = {
	name: 'Creating user best post sorted sets',
	timestamp: Date.UTC(2016, 0, 14),
	method: function (callback) {
		var batch = require('../../batch');
		var progress = this.progress;

		batch.processSortedSet('posts:pid', function (ids, next) {
			async.eachSeries(ids, function (id, next) {
				db.getObjectFields('post:' + id, ['pid', 'uid', 'votes'], function (err, postData) {
					if (err) {
						return next(err);
					}
					if (!postData || !parseInt(postData.votes, 10) || !parseInt(postData.uid, 10)) {
						return next();
					}
					winston.verbose('processing pid: ' + postData.pid + ' uid: ' + postData.uid + ' votes: ' + postData.votes);
					db.sortedSetAdd('uid:' + postData.uid + ':posts:votes', postData.votes, postData.pid, next);
					progress.incr();
				});
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
