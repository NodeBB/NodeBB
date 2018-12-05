'use strict';

var async = require('async');
var db = require('../../database');
var batch = require('../../batch');


module.exports = {
	name: 'Remove relative_path from uploaded profile cover urls',
	timestamp: Date.UTC(2017, 3, 26),
	method: function (callback) {
		var progress = this.progress;

		batch.processSortedSet('users:joindate', function (ids, done) {
			async.each(ids, function (uid, cb) {
				async.waterfall([
					function (next) {
						db.getObjectField('user:' + uid, 'cover:url', next);
					},
					function (url, next) {
						progress.incr();

						if (!url) {
							return next();
						}

						var newUrl = url.replace(/^.*?\/uploads\//, '/assets/uploads/');
						db.setObjectField('user:' + uid, 'cover:url', newUrl, next);
					},
				], cb);
			}, done);
		}, {
			progress: this.progress,
		}, callback);
	},
};
