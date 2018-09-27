'use strict';

var async = require('async');
var posts = require('../../posts');

module.exports = {
	name: 'Refresh post-upload associations',
	timestamp: Date.UTC(2018, 3, 16),
	method: function (callback) {
		var progress = this.progress;

		require('../../batch').processSortedSet('posts:pid', function (pids, next) {
			async.each(pids, function (pid, next) {
				posts.uploads.sync(pid, next);
				progress.incr();
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
