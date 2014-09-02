
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
		var digestsDisabled = meta.config.disableEmailSubscriptions !== undefined && parseInt(meta.config.disableEmailSubscriptions, 10) === 1;
		if (digestsDisabled) {
			return winston.log('[user/jobs] Did not send daily digests because subscription system is disabled.');
		}

		async.parallel({
			recent: function(next) {
				topics.getLatestTopics(0, 0, 10, 'day', next);
			},
			uids: function(next) {
				db.getSortedSetRange('users:joindate', 0, -1, next);
			}
		}, function(err, data) {
			if (err) {
				return winston.error('[user/jobs] Could not send daily digests: ' + err.message);
			}

			User.getMultipleUserSettings(data.uids, function(err, userSettings) {
				if (err) {
					return winston.error('[user/jobs] Could not send daily digests: ' + err.message);
				}

				var subscribed = userSettings.filter(function(setting) {
					return setting.dailyDigestFreq === 'daily';
				}).map(function(setting) {
					return setting.uid;
				});

				sendEmails(subscribed, data.recent.topics);
			});
		});
	};

	function sendEmails(uids, recentTopics) {
		var	now = new Date();

		User.getMultipleUserFields(uids, ['uid', 'username', 'lastonline'], function(err, users) {
			if (err) {
				return winston.error('[user/jobs] Could not send daily digests: ' + err.message);
			}
			// Consider using eachLimit, but *only* if people complain about email relays choking -- otherwise we're ok.
			async.eachLimit(users, 100, function(userObj, next) {
				user.notifications.getDailyUnread(userObj.uid, function(err, notifications) {
					if (err) {
						winston.error('[user/jobs] Could not send daily digests: ' + err.message);
						return next(err);
					}

					// Remove expired notifications
					notifications = notifications.filter(Boolean);

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
						site_title: meta.config.title || meta.config.browserTitle || 'NodeBB',
						notifications: notifications,
						recent: recentTopics
					});

					next();
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
	}

};

