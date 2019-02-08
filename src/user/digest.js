'use strict';

var async = require('async');
var winston = require('winston');
var nconf = require('nconf');

var batch = require('../batch');
var meta = require('../meta');
var user = require('../user');
var topics = require('../topics');
var plugins = require('../plugins');
var emailer = require('../emailer');
var utils = require('../utils');

var Digest = module.exports;

Digest.execute = function (payload, callback) {
	callback = callback || function () {};

	var digestsDisabled = meta.config.disableEmailSubscriptions === 1;
	if (digestsDisabled) {
		winston.info('[user/jobs] Did not send digests (' + payload.interval + ') because subscription system is disabled.');
		return callback();
	}

	async.waterfall([
		function (next) {
			if (payload.subscribers) {
				setImmediate(next, undefined, payload.subscribers);
			} else {
				Digest.getSubscribers(payload.interval, next);
			}
		},
		function (subscribers, next) {
			if (!subscribers.length) {
				return callback();
			}

			var data = {
				interval: payload.interval,
				subscribers: subscribers,
			};

			Digest.send(data, next);
		},
	], function (err, count) {
		if (err) {
			winston.error('[user/jobs] Could not send digests (' + payload.interval + ')', err);
		} else {
			winston.info('[user/jobs] Digest (' + payload.interval + ') scheduling completed. ' + count + ' email(s) sent.');
		}

		callback(err);
	});
};

Digest.getSubscribers = function (interval, callback) {
	async.waterfall([
		function (next) {
			var subs = [];

			batch.processSortedSet('users:joindate', function (uids, next) {
				async.waterfall([
					function (next) {
						user.getMultipleUserSettings(uids, next);
					},
					function (settings, next) {
						settings.forEach(function (hash) {
							if (hash.dailyDigestFreq === interval) {
								subs.push(hash.uid);
							}
						});
						next();
					},
				], next);
			}, { interval: 1000 }, function (err) {
				next(err, subs);
			});
		},
		function (subscribers, next) {
			async.filter(subscribers, function (uid, next) {
				user.isBanned(uid, function (err, banned) {
					next(err, !banned);
				});
			}, next);
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
	var emailsSent = 0;
	if (!data || !data.subscribers || !data.subscribers.length) {
		return callback(null, emailsSent);
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
						async.parallel({
							notifications: async.apply(user.notifications.getDailyUnread, userObj.uid),
							topics: async.apply(getTermTopics, data.interval, userObj.uid, 0, 9),
						}, next);
					},
					function (data, next) {
						var notifications = data.notifications.filter(Boolean);

						// If there are no notifications and no new topics, don't bother sending a digest
						if (!notifications.length && !data.topics.length) {
							return next();
						}

						notifications.forEach(function (notification) {
							if (notification.image && !notification.image.startsWith('http')) {
								notification.image = nconf.get('url') + notification.image;
							}
						});

						// Fix relative paths in topic data
						data.topics = data.topics.map(function (topicObj) {
							var user = topicObj.hasOwnProperty('teaser') && topicObj.teaser !== undefined ? topicObj.teaser.user : topicObj.user;
							if (user && user.picture && utils.isRelativeUrl(user.picture)) {
								user.picture = nconf.get('base_url') + user.picture;
							}

							return topicObj;
						});
						emailsSent += 1;
						emailer.send('digest', userObj.uid, {
							subject: '[[email:digest.subject, ' + (now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate()) + ']]',
							username: userObj.username,
							userslug: userObj.userslug,
							notifications: notifications,
							recent: data.topics,
							interval: data.interval,
							showUnsubscribe: true,
						}, function (err) {
							if (err) {
								winston.error('[user/jobs] Could not send digest email', err);
							}
						});
						next();
					},
				], next);
			}, next);
		},
	], function (err) {
		callback(err, emailsSent);
	});

	function getTermTopics(term, uid, start, stop, callback) {
		async.waterfall([
			function (next) {
				topics.getSortedTopics({
					uid: uid,
					start: start,
					stop: stop,
					term: term,
					sort: 'posts',
				}, next);
			},
			function (data, next) {
				if (!data.topics.length) {
					topics.getLatestTopics(uid, start, stop, term, next);
				} else {
					next(null, data);
				}
			},
			function (data, next) {
				next(null, data.topics);
			},
		], callback);
	}
};
