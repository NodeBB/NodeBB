'use strict';

var async = require('async');
var batch = require('../../batch');
var db = require('../../database');

module.exports = {
	name: 'Convert old notification digest settings',
	timestamp: Date.UTC(2017, 10, 15),
	method: function (callback) {
		var progress = this.progress;

		batch.processSortedSet('users:joindate', function (uids, next) {
			async.eachLimit(uids, 500, function (uid, next) {
				progress.incr();
				async.waterfall([
					function (next) {
						db.getObjectFields('user:' + uid + ':settings', ['sendChatNotifications', 'sendPostNotifications'], next);
					},
					function (userSettings, _next) {
						if (!userSettings) {
							return next();
						}
						var tasks = [];
						if (parseInt(userSettings.sendChatNotifications, 10) === 1) {
							tasks.push(async.apply(db.setObjectField, 'user:' + uid + ':settings', 'notificationType_new-chat', 'notificationemail'));
						}
						if (parseInt(userSettings.sendPostNotifications, 10) === 1) {
							tasks.push(async.apply(db.setObjectField, 'user:' + uid + ':settings', 'notificationType_new-reply', 'notificationemail'));
						}
						if (!tasks.length) {
							return next();
						}

						async.series(tasks, function (err) {
							_next(err);
						});
					},
					function (next) {
						db.deleteObjectFields('user:' + uid + ':settings', ['sendChatNotifications', 'sendPostNotifications'], next);
					},
				], next);
			}, next);
		}, {
			progress: progress,
		}, callback);
	},
};
