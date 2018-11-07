'use strict';


var async = require('async');
var winston = require('winston');
var db = require('../../database');

module.exports = {
	name: 'Sorted sets for post replies',
	timestamp: Date.UTC(2016, 9, 14),
	method: function (callback) {
		var posts = require('../../posts');
		var batch = require('../../batch');
		var progress = this.progress;

		batch.processSortedSet('posts:pid', function (ids, next) {
			posts.getPostsFields(ids, ['pid', 'toPid', 'timestamp'], function (err, data) {
				if (err) {
					return next(err);
				}

				progress.incr();

				async.eachSeries(data, function (postData, next) {
					if (!parseInt(postData.toPid, 10)) {
						return next(null);
					}
					winston.verbose('processing pid: ' + postData.pid + ' toPid: ' + postData.toPid);
					async.parallel([
						async.apply(db.sortedSetAdd, 'pid:' + postData.toPid + ':replies', postData.timestamp, postData.pid),
						async.apply(db.incrObjectField, 'post:' + postData.toPid, 'replies'),
					], next);
				}, next);
			});
		}, {
			progress: progress,
		}, callback);
	},
};
