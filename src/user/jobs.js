
'use strict';

var db = require('../database'),
	async = require('async'),
	winston = require('winston'),
	cronJob = require('cron').CronJob,
	nconf = require('nconf'),

	user = require('../user'),
	UserNotifications = require('./notifications'),
	topics = require('../topics'),
	emailer = require('../emailer'),
	meta = require('../meta');

module.exports = function(User) {
	User.startJobs = function() {
		winston.info('[user.startJobs] Registering User Jobs');

		new cronJob('0 0 17 * * *', function() {
			User.sendDailyDigests();
		}, null, true);
	};

	User.sendDailyDigests = function() {
		async.parallel({
			recent: function(next) {
				topics.getLatestTopics(0, 0, 10, 'day', next);
			},
			uids: function(next) {
				db.getSortedSetRange('users:joindate', 0, -1, next);
			}
		}, function(err, data) {
			var	now = new Date();

			async.each(data.uids, function(uid, next) {
				UserNotifications.getDailyUnread(uid, function(err, notifications) {
					if (!err && notifications && notifications.length) {

						for(var i=0; i<notifications.length; ++i) {
							if (notifications[i].image.indexOf('http') !== 0) {
								notifications[i].image = nconf.get('url') + notifications[i].image;
							}
						}

						user.getUserField(uid, 'username', function(err, username) {
							// Send daily digest email
							// winston.info('[user/notifications] Sending Daily Digest to uid ' + uid);
							emailer.send('dailydigest', uid, {
								subject: '[' + meta.config.title + '] Daily Digest for ' + now.getFullYear()+ '/' + (now.getMonth()+1) + '/' + now.getDate(),
								username: username,
								url: nconf.get('url'),
								site_title: meta.config.title,
								notifications: notifications,
								recent: data.recent.topics
							});
						});
					}

					next(err);
				});
			}, function(err) {
				// When finished...
				if (!err) {
					winston.info('[user/jobs] Daily Digests sent!');
				} else {
					winston.error('[user/jobs] Could not send daily digests: ' + err.message);
				}
			});
		});
	};
};

