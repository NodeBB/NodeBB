'use strict';

var db = require('../../database');

var async = require('async');
var winston = require('winston');

module.exports = {
	name: 'Creating users:notvalidated',
	timestamp: Date.UTC(2016, 0, 20),
	method: function (callback) {
		var batch = require('../../batch');
		var now = Date.now();
		batch.processSortedSet('users:joindate', function (ids, next) {
			async.eachSeries(ids, function (id, next) {
				db.getObjectFields('user:' + id, ['uid', 'email:confirmed'], function (err, userData) {
					if (err) {
						return next(err);
					}
					if (!userData || !parseInt(userData.uid, 10) || parseInt(userData['email:confirmed'], 10) === 1) {
						return next();
					}
					winston.verbose('processing uid: ' + userData.uid + ' email:confirmed: ' + userData['email:confirmed']);
					db.sortedSetAdd('users:notvalidated', now, userData.uid, next);
				});
			}, next);
		}, callback);
	},
};
