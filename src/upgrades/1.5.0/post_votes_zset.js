'use strict';

var async = require('async');
var db = require('../../database');


module.exports = {
	name: 'New sorted set posts:votes',
	timestamp: Date.UTC(2017, 1, 27),
	method: function (callback) {
		var progress = this.progress;

		require('../../batch').processSortedSet('posts:pid', function (pids, next) {
			async.each(pids, function (pid, next) {
				db.getObjectFields('post:' + pid, ['upvotes', 'downvotes'], function (err, postData) {
					if (err || !postData) {
						return next(err);
					}

					progress.incr();
					var votes = parseInt(postData.upvotes || 0, 10) - parseInt(postData.downvotes || 0, 10);
					db.sortedSetAdd('posts:votes', votes, pid, next);
				});
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
