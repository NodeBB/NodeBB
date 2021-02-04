'use strict';

const async = require('async');
const batch = require('../../batch');
const db = require('../../database');

module.exports = {
	name: 'Convert old notification digest settings',
	timestamp: Date.UTC(2017, 10, 15),
	method: function (callback) {
		const progress = this.progress;

		batch.processSortedSet('users:joindate', (uids, next) => {
			async.eachLimit(uids, 500, (uid, next) => {
				progress.incr();
				async.waterfall([
					function (next) {
						db.getObjectFields(`user:${uid}:settings`, ['sendChatNotifications', 'sendPostNotifications'], next);
					},
					function (userSettings, _next) {
						if (!userSettings) {
							return next();
						}
						const tasks = [];
						if (parseInt(userSettings.sendChatNotifications, 10) === 1) {
							tasks.push(async.apply(db.setObjectField, `user:${uid}:settings`, 'notificationType_new-chat', 'notificationemail'));
						}
						if (parseInt(userSettings.sendPostNotifications, 10) === 1) {
							tasks.push(async.apply(db.setObjectField, `user:${uid}:settings`, 'notificationType_new-reply', 'notificationemail'));
						}
						if (!tasks.length) {
							return next();
						}

						async.series(tasks, (err) => {
							_next(err);
						});
					},
					function (next) {
						db.deleteObjectFields(`user:${uid}:settings`, ['sendChatNotifications', 'sendPostNotifications'], next);
					},
				], next);
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
