
'use strict';

var db = require('../database'),
	async = require('async'),
	winston = require('winston'),
	cronJob = require('cron').CronJob,
	nconf = require('nconf'),

	user = require('../user'),
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
		var	yesterday = Date.now() - (1000*60*60*24);

		async.parallel({
			recent: function(next) {
				topics.getLatestTopics(0, 0, 10, 'day', next);
			},
			uids: function(next) {
				db.getSortedSetRange('users:joindate', 0, -1, next);
			}
		}, function(err, data) {
			var	now = new Date();

			async.parallel({
				recipients: function(next) {
					User.getMultipleUserFields(data.uids, ['uid', 'username', 'lastonline'], next);
				},
				userSettings: function(next) {
					User.getMultipleUserSettings(data.uids, next);
				}
			}, function(err, users) {
				var recipients = users.recipients,
					userSettings = users.userSettings,
					subscribed;

				// Find uids subscribed to daily digest emails
				subscribed = userSettings.filter(function(setting) {
					return setting.dailyDigestFreq === 'daily';
				}).map(function(setting) {
					return setting.uid;
				});

				// Find only those users who have not been online in the past 24 hours
				var	users = recipients.filter(function(userObj) {
					return subscribed.indexOf(userObj.uid) !== -1 && yesterday > parseInt(userObj.lastonline, 10);
				});

				// Consider using eachLimit, but *only* if people complain about email relays choking -- otherwise we're ok.
				async.eachLimit(users, 100, function(userObj, next) {
					user.notifications.getDailyUnread(userObj.uid, function(err, notifications) {
						// Turn relative URLs into absolute ones
						for(var i=0; i<notifications.length; ++i) {
							if (notifications[i].image.indexOf('http') !== 0) {
								notifications[i].image = nconf.get('url') + notifications[i].image;
							}
						}

						// Send daily digest email
						// winston.info('[user/notifications] Sending Daily Digest to uid ' + userObj.uid);
						emailer.send('dailydigest', userObj.uid, {
							subject: '[' + meta.config.title + '] Daily Digest for ' + now.getFullYear()+ '/' + (now.getMonth()+1) + '/' + now.getDate(),
							username: userObj.username,
							url: nconf.get('url'),
							site_title: meta.config.title,
							notifications: notifications,
							recent: data.recent.topics
						});

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
		});
	};
};

