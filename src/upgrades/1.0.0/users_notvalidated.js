'use strict';


const async = require('async');
const winston = require('winston');
const db = require('../../database');

module.exports = {
	name: 'Creating users:notvalidated',
	timestamp: Date.UTC(2016, 0, 20),
	method: function (callback) {
		const batch = require('../../batch');
		const now = Date.now();
		batch.processSortedSet('users:joindate', (ids, next) => {
			async.eachSeries(ids, (id, next) => {
				db.getObjectFields(`user:${id}`, ['uid', 'email:confirmed'], (err, userData) => {
					if (err) {
						return next(err);
					}
					if (!userData || !parseInt(userData.uid, 10) || parseInt(userData['email:confirmed'], 10) === 1) {
						return next();
					}
					winston.verbose(`processing uid: ${userData.uid} email:confirmed: ${userData['email:confirmed']}`);
					db.sortedSetAdd('users:notvalidated', now, userData.uid, next);
				});
			}, next);
		}, callback);
	},
};
