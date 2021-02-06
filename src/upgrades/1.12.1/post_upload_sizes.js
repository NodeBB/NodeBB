'use strict';

const async = require('async');

const batch = require('../../batch');
const posts = require('../../posts');

module.exports = {
	name: 'Calculate image sizes of all uploaded images',
	timestamp: Date.UTC(2019, 2, 16),
	method: function (callback) {
		const { progress } = this;

		batch.processSortedSet('posts:pid', (postData, next) => {
			async.eachSeries(postData, async (pid) => {
				const uploads = await posts.uploads.list(pid);
				await posts.uploads.saveSize(uploads);
				progress.incr();
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
