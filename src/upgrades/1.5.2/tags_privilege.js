'use strict';

var async = require('async');

var batch = require('../../batch');

module.exports = {
	name: 'Give tag privilege to registered-users on all categories',
	timestamp: Date.UTC(2017, 5, 16),
	method: function (callback) {
		var progress = this.progress;
		var privileges = require('../../privileges');
		batch.processSortedSet('categories:cid', function (cids, next) {
			async.eachSeries(cids, function (cid, next) {
				progress.incr();
				privileges.categories.give(['topics:tag'], cid, 'registered-users', next);
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
