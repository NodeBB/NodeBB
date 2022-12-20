'use strict';

import async from 'async';

import * as batch from '../../batch';
import privileges from '../../privileges';

export const obj = {
	name: 'Give tag privilege to registered-users on all categories',
	timestamp: Date.UTC(2017, 5, 16),
	method: function (callback) {
		const { progress } = this;
		batch.processSortedSet('categories:cid', (cids, next) => {
			async.eachSeries(cids, (cid, next) => {
				progress.incr();
				privileges.categories.give(['groups:topics:tag'], cid, 'registered-users', next);
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
