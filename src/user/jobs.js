
'use strict';

var db = require('../database'),
	async = require('async'),
	winston = require('winston'),
	cronJob = require('cron').CronJob,
	nconf = require('nconf'),

	user = require('../user'),
	topics = require('../topics'),
	emailer = require('../emailer'),
	meta = require('../meta'),
	batch = require('../batch');

module.exports = function(User) {
	User.startJobs = function() {
		winston.info('[user.startJobs] Registering User Jobs');

		new cronJob('0 0 17 * * *', function() {
			User.sendDailyDigests();
		}, null, true);
	};

	User.sendDailyDigests = function() {
		var digestsDisabled = meta.config.disableEmailSubscriptions !== undefined && parseInt(meta.config.disableEmailSubscriptions, 10) === 1;
		if (digestsDisabled) {
			return winston.log('[user/jobs] Did not send daily digests because subscription system is disabled.');
		}

		topics.getLatestTopics(0, 0, 10, 'day', function(err, topics) {
			if (err) {
				return winston.error('[user/jobs] Could not send daily digests: ' + err.message);
			}

			batch.processSortedSet('users:joindate', function(uids, next) {
				User.getMultipleUserSettings(uids, function(err, userSettings) {
					if (err) {
						return next(err);
					}

					var subscribed = userSettings.filter(function(setting) {
						return setting.dailyDigestFreq === 'daily';
					}).map(function(setting) {
						return setting.uid;
					});

					if (!subscribed.length) {
						return next();
					}

					sendEmails(subscribed, topics, next);
				});
			}, function(err) {
				if (err) {
					winston.error('[user/jobs] Could not send daily digests: ' + err.message);
				} else {
					winston.info('[user/jobs] Daily Digests sent!');
				}
			});
		});
	};

	function sendEmails(uids, recentTopics, callback) {
		var	now = new Date();

		User.getMultipleUserFields(uids, ['uid', 'username', 'lastonline'], function(err, users) {
			if (err) {
				winston.error('[user/jobs] Could not send daily digests: ' + err.message);
				return callback(err);
			}

			async.eachLimit(users, 100, function(userObj, next) {
				user.notifications.getDailyUnread(userObj.uid, function(err, notifications) {
					if (err) {
						winston.error('[user/jobs] Could not send daily digests: ' + err.message);
						return next(err);
					}

					notifications = notifications.filter(Boolean);

					for(var i=0; i<notifications.length; ++i) {
						if (notifications[i].image.indexOf('http') !== 0) {
							notifications[i].image = nconf.get('url') + notifications[i].image;
						}
					}

					emailer.send('dailydigest', userObj.uid, {
						subject: '[' + meta.config.title + '] Daily Digest for ' + now.getFullYear()+ '/' + (now.getMonth()+1) + '/' + now.getDate(),
						username: userObj.username,
						url: nconf.get('url'),
						site_title: meta.config.title || meta.config.browserTitle || 'NodeBB',
						notifications: notifications,
						recent: recentTopics
					});

					next();
				});
			}, callback);
		});
	}

};

