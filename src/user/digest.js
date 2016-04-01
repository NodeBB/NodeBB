"use strict";

var	async = require('async');
var winston = require('winston');
var nconf = require('nconf');

var db = require('../database');
var meta = require('../meta');
var user = require('../user');
var topics = require('../topics');
var plugins = require('../plugins');
var emailer = require('../emailer');
var utils = require('../../public/src/utils');

(function(Digest) {
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

			// Fix relative paths in topic data
			data.topics.topics = data.topics.topics.map(function(topicObj) {
				var user = topicObj.hasOwnProperty('teaser') && topicObj.teaser !== undefined ? topicObj.teaser.user : topicObj.user;
				if (user && user.picture && utils.isRelativeUrl(user.picture)) {
					user.picture = nconf.get('base_url') + user.picture;
				}

				return topicObj;
			});

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
		db.getSortedSetRange('digest:' + interval + ':uids', 0, -1, function(err, subscribers) {
			plugins.fireHook('filter:digest.subscribers', {
				interval: interval,
				subscribers: subscribers
			}, function(err, returnData) {
				callback(err, returnData.subscribers);
			});
		});
	};

	Digest.send = function(data, callback) {
		var	now = new Date();

		user.getUsersFields(data.subscribers, ['uid', 'username', 'userslug', 'lastonline'], function(err, users) {
			if (err) {
				winston.error('[user/jobs] Could not send digests (' + data.interval + '): ' + err.message);
				return callback(err);
			}

			async.eachLimit(users, 100, function(userObj, next) {
				user.notifications.getDailyUnread(userObj.uid, function(err, notifications) {
					if (err) {
						winston.error('[user/jobs] Could not send digests (' + data.interval + '): ' + err.message);
						return next(err);
					}

					notifications = notifications.filter(Boolean);

					// If there are no notifications and no new topics, don't bother sending a digest
					if (!notifications.length && !data.topics.topics.length) {
						return next();
					}

					for(var i=0; i<notifications.length; ++i) {
						if (notifications[i].image && notifications[i].image.indexOf('http') !== 0) {
							notifications[i].image = nconf.get('url') + notifications[i].image;
						}
					}

					emailer.send('digest', userObj.uid, {
						subject: '[' + meta.config.title + '] [[email:digest.subject, ' + (now.getFullYear()+ '/' + (now.getMonth()+1) + '/' + now.getDate()) + ']]',
						username: userObj.username,
						userslug: userObj.userslug,
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
	};

}(module.exports));
