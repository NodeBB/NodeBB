'use strict';

const async = require('async');
import db from '../../database';


export default  {
	name: 'New sorted set posts:votes',
	timestamp: Date.UTC(2017, 1, 27),
	method: function (callback) {
		const { progress } = this as any;

		require('../../batch').processSortedSet('posts:pid', (pids, next) => {
			async.each(pids, (pid, next) => {
				db.getObjectFields(`post:${pid}`, ['upvotes', 'downvotes'], (err, postData) => {
					if (err || !postData) {
						return next(err);
					}

					progress.incr();
					const votes = parseInt(postData.upvotes || 0, 10) - parseInt(postData.downvotes || 0, 10);
					db.sortedSetAdd('posts:votes', votes, pid, next);
				});
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
