'use strict';

import async from 'async';
import posts from '../../posts';

export const obj = {
	name: 'Refresh post-upload associations',
	timestamp: Date.UTC(2018, 3, 16),
	method: function (callback) {
		const { progress } = this;

		require('../../batch').processSortedSet('posts:pid', (pids, next) => {
			async.each(pids, (pid, next) => {
				posts.uploads.sync(pid, next);
				progress.incr();
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
