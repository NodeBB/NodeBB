'use strict';


const async = require('async');
import winston from 'winston';
import * as database from '../../database';
const db = database as any;
import user from '../../user';


export default  {
	name: 'Group title from settings to user profile',
	timestamp: Date.UTC(2016, 3, 14),
	method: function (callback) {
		const batch = require('../../batch');
		let count = 0;
		batch.processSortedSet('users:joindate', (uids, next) => {
			winston.verbose(`upgraded ${count} users`);
			user.getMultipleUserSettings(uids, (err, settings) => {
				if (err) {
					return next(err);
				}
				count += uids.length;
				settings = settings.filter(setting => setting && setting.groupTitle);

				async.each(settings, (setting, next) => {
					db.setObjectField(`user:${setting.uid}`, 'groupTitle', setting.groupTitle, next);
				}, next);
			});
		}, {}, callback);
	},
};
