'use strict';


import async from 'async';
import winston from 'winston';
import db from '../../database';
import * as batch from '../../batch';


export const obj = {
	name: 'Creating users:notvalidated',
	timestamp: Date.UTC(2016, 0, 20),
	method: function (callback) {
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
