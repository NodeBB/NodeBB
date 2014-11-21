"use strict";

var	async = require('async'),
	winston = require('winston'),
	nconf = require('nconf'),

	db = require('../database'),
	meta = require('../meta'),
	user = require('../user'),
	topics = require('../topics'),
	batch = require('../batch'),
	emailer = require('../emailer');

module.exports = (function(Digest) {
	Digest.execute = function(interval) {
		var digestsDisabled = meta.config.disableEmailSubscriptions !== undefined && parseInt(meta.config.disableEmailSubscriptions, 10) === 1;
		if (digestsDisabled) {
			return winston.verbose('[user/jobs] Did not send digests (' + interval + ') because subscription system is disabled.');
		}

		if (!interval) {
			// interval is one of: day, week, month, or year
			interval = 'day';
		}

		async.parallel({
			topics: async.apply(topics.getLatestTopics, 0, 0, 9, interval),
			subscribers: async.apply(Digest.getSubscribers, interval)
		}, function(err, data) {
			if (err) {
				return winston.error('[user/jobs] Could not send digests (' + interval + '): ' + err.message);
			}

			data.interval = interval;

			if (data.subscribers.length) {
				Digest.send(data, function(err) {
					if (err) {
						winston.error('[user/jobs] Could not send digests (' + interval + '): ' + err.message);
					} else {
						winston.info('[user/jobs] Digest (' + interval + ') scheduling completed.');
					}
				});
			} else {
				winston.verbose('[user/jobs] No users subscribing to digest (' + interval + '). Digest not sent.');
			}
		});
	};

	Digest.getSubscribers = function(interval, callback) {
		async.waterfall([
			async.apply(db.getSortedSetRange, 'users:joindate', 0, -1),
			async.apply(user.getMultipleUserSettings)
		], function(err, userSettings) {
			if (err) {
				return callback(err);
			}

			var subscribed = userSettings.filter(function(setting) {
				return setting.dailyDigestFreq === interval;
			}).map(function(setting) {
				return setting.uid;
			});

			callback(null, subscribed);
		});
	};

	Digest.send = function(data, callback) {
		var	now = new Date();

		user.getMultipleUserFields(data.subscribers, ['uid', 'username', 'lastonline'], function(err, users) {
			if (err) {
				winston.error('[user/jobs] Could not send digests (' + interval + '): ' + err.message);
				return callback(err);
			}

			async.eachLimit(users, 100, function(userObj, next) {
				user.notifications.getDailyUnread(userObj.uid, function(err, notifications) {
					if (err) {
						winston.error('[user/jobs] Could not send digests (' + interval + '): ' + err.message);
						return next(err);
					}

					notifications = notifications.filter(Boolean);

					for(var i=0; i<notifications.length; ++i) {
						if (notifications[i].image.indexOf('http') !== 0) {
							notifications[i].image = nconf.get('url') + notifications[i].image;
						}
					}

					emailer.send('digest', userObj.uid, {
						subject: '[' + meta.config.title + '] Digest for ' + now.getFullYear()+ '/' + (now.getMonth()+1) + '/' + now.getDate(),
						username: userObj.username,
						url: nconf.get('url'),
						site_title: meta.config.title || meta.config.browserTitle || 'NodeBB',
						notifications: notifications,
						recent: data.topics.topics,
						interval: data.interval
					});

					next();
				});
			}, callback);
		});
	}

	return Digest;
})({});
