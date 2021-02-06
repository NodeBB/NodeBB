'use strict';

const async = require('async');
const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Update moderation notes to zset',
	timestamp: Date.UTC(2017, 2, 22),
	method: function (callback) {
		const { progress } = this;

		batch.processSortedSet('users:joindate', (ids, next) => {
			async.each(ids, (uid, next) => {
				db.getObjectField(`user:${uid}`, 'moderationNote', (err, moderationNote) => {
					if (err || !moderationNote) {
						progress.incr();
						return next(err);
					}
					const note = {
						uid: 1,
						note: moderationNote,
						timestamp: Date.now(),
					};

					progress.incr();
					db.sortedSetAdd(`uid:${uid}:moderation:notes`, note.timestamp, JSON.stringify(note), next);
				});
			}, next);
		}, {
			progress: this.progress,
		}, callback);
	},
};
