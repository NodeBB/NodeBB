'use strict';

const async = require('async');
const db = require('../../database');
const batch = require('../../batch');


module.exports = {
	name: 'Remove relative_path from uploaded profile cover urls',
	timestamp: Date.UTC(2017, 3, 26),
	method: function (callback) {
		const { progress } = this;

		batch.processSortedSet('users:joindate', (ids, done) => {
			async.each(ids, (uid, cb) => {
				async.waterfall([
					function (next) {
						db.getObjectField(`user:${uid}`, 'cover:url', next);
					},
					function (url, next) {
						progress.incr();

						if (!url) {
							return next();
						}

						const newUrl = url.replace(/^.*?\/uploads\//, '/assets/uploads/');
						db.setObjectField(`user:${uid}`, 'cover:url', newUrl, next);
					},
				], cb);
			}, done);
		}, {
			progress: this.progress,
		}, callback);
	},
};
