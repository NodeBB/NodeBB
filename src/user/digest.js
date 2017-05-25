'use strict';

var async = require('async');
var winston = require('winston');
var nconf = require('nconf');

var db = require('../database');
var meta = require('../meta');
var user = require('../user');
var topics = require('../topics');
var plugins = require('../plugins');
var emailer = require('../emailer');
var utils = require('../utils');

var Digest = module.exports;

Digest.execute = function (payload, callback) {
	callback = callback || function () {};

	var digestsDisabled = parseInt(meta.config.disableEmailSubscriptions, 10) === 1;
	if (digestsDisabled) {
		winston.info('[user/jobs] Did not send digests (' + payload.interval + ') because subscription system is disabled.');
		return callback();
	}

	var subscribers;
	async.waterfall([
		function (next) {
			async.parallel({
				topics: async.apply(topics.getLatestTopics, 0, 0, 9, payload.interval),
				subscribers: function (next) {
					if (payload.subscribers) {
						setImmediate(next, undefined, payload.subscribers);
					} else {
						Digest.getSubscribers(payload.interval, next);
					}
				},
			}, next);
		},
		function (data, next) {
			subscribers = data.subscribers;
			if (!data.subscribers.length) {
				return callback();
			}

			// Fix relative paths in topic data
			data.topics.topics = data.topics.topics.map(function (topicObj) {
				var user = topicObj.hasOwnProperty('teaser') && topicObj.teaser !== undefined ? topicObj.teaser.user : topicObj.user;
				if (user && user.picture && utils.isRelativeUrl(user.picture)) {
					user.picture = nconf.get('base_url') + user.picture;
				}

				return topicObj;
			});

			data.interval = payload.interval;
			Digest.send(data, next);
		},
	], function (err) {
		if (err) {
			winston.error('[user/jobs] Could not send digests (' + payload.interval + '): ' + err.message);
		} else {
			winston.info('[user/jobs] Digest (' + payload.interval + ') scheduling completed. ' + subscribers.length + ' email(s) sent.');
		}

		callback(err);
	});
};

Digest.getSubscribers = function (interval, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('digest:' + interval + ':uids', 0, -1, next);
		},
		function (subscribers, next) {
			plugins.fireHook('filter:digest.subscribers', {
				interval: interval,
				subscribers: subscribers,
			}, next);
		},
		function (results, next) {
			next(null, results.subscribers);
		},
	], callback);
};

Digest.send = function (data, callback) {
	if (!data || !data.subscribers || !data.subscribers.length) {
		return callback();
	}
	var now = new Date();

	async.waterfall([
		function (next) {
			user.getUsersFields(data.subscribers, ['uid', 'username', 'userslug', 'lastonline'], next);
		},
		function (users, next) {
			async.eachLimit(users, 100, function (userObj, next) {
				async.waterfall([
					function (next) {
						user.notifications.getDailyUnread(userObj.uid, next);
					},
					function (notifications, next) {
						notifications = notifications.filter(Boolean);
						// If there are no notifications and no new topics, don't bother sending a digest
						if (!notifications.length && !data.topics.topics.length) {
							return next();
						}

						notifications.forEach(function (notification) {
							if (notification.image && !notification.image.startsWith('http')) {
								notification.image = nconf.get('url') + notification.image;
							}
						});

						emailer.send('digest', userObj.uid, {
							subject: '[' + meta.config.title + '] [[email:digest.subject, ' + (now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate()) + ']]',
							username: userObj.username,
							userslug: userObj.userslug,
							url: nconf.get('url'),
							site_title: meta.config.title || meta.config.browserTitle || 'NodeBB',
							notifications: notifications,
							recent: data.topics.topics,
							interval: data.interval,
						});
						next();
					},
				], next);
			}, next);
		},
	], function (err) {
		callback(err);
	});
};
