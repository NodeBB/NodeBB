'use strict';

const async = require('async');
const batch = require('../../batch');
import { primaryDB as db } from '../../database';

export default  {
	name: 'Wipe all existing RSS tokens',
	timestamp: Date.UTC(2017, 6, 5),
	method: function (callback) {
		const { progress } = this as any;

		batch.processSortedSet('users:joindate', (uids, next) => {
			async.eachLimit(uids, 500, (uid, next) => {
				progress.incr();
				db.deleteObjectField(`user:${uid}`, 'rss_token', next);
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
