
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	S = require('string'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	postTools = require('../postTools'),
	notifications = require('../notifications'),
	meta = require('../meta'),
	emailer = require('../emailer');

module.exports = function(Topics) {

	Topics.toggleFollow = function(tid, uid, callback) {
		callback = callback || function() {};
		var isFollowing;
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				Topics.isFollowing([tid], uid, next);
			},
			function (_isFollowing, next) {
				isFollowing = _isFollowing[0];
				if (isFollowing) {
					Topics.unfollow(tid, uid, next);
				} else {
					Topics.follow(tid, uid, next);
				}
			},
			function(next) {
				next(null, !isFollowing);
			}
		], callback);
	};

	Topics.follow = function(tid, uid, callback) {
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				db.setAdd('tid:' + tid + ':followers', uid, next);
			},
			function(next) {
				db.sortedSetAdd('uid:' + uid + ':followed_tids', Date.now(), tid, next);
			}
		], callback);
	};

	Topics.unfollow = function(tid, uid, callback) {
		callback = callback || function() {};
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				db.setRemove('tid:' + tid + ':followers', uid, next);
			},
			function(next) {
				db.sortedSetRemove('uid:' + uid + ':followed_tids', tid, next);
			}
		], callback);
	};

	Topics.isFollowing = function(tids, uid, callback) {
		if (!Array.isArray(tids)) {
			return callback();
		}
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function() { return false; }));
		}
		var keys = tids.map(function(tid) {
			return 'tid:' + tid + ':followers';
		});
		db.isMemberOfSets(keys, uid, callback);
	};

	Topics.getFollowers = function(tid, callback) {
		db.getSetMembers('tid:' + tid + ':followers', callback);
	};

	Topics.notifyFollowers = function(postData, exceptUid) {
		Topics.getFollowers(postData.topic.tid, function(err, followers) {
			if (err || !Array.isArray(followers) || !followers.length) {
				return;
			}

			var index = followers.indexOf(exceptUid.toString());
			if (index !== -1) {
				followers.splice(index, 1);
			}

			if (!followers.length) {
				return;
			}

			var title = postData.topic.title;
			if (title) {
				title = S(title).decodeHTMLEntities().s;
			}

			notifications.create({
				bodyShort: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + title + ']]',
				bodyLong: postData.content,
				pid: postData.pid,
				nid: 'tid:' + postData.topic.tid + ':pid:' + postData.pid + ':uid:' + exceptUid,
				tid: postData.topic.tid,
				from: exceptUid
			}, function(err, notification) {
				if (!err && notification) {
					notifications.push(notification, followers);
				}
			});

			async.eachLimit(followers, 3, function(toUid, next) {
				async.parallel({
					userData: async.apply(user.getUserFields, toUid, ['username']),
					userSettings: async.apply(user.getSettings, toUid)
				}, function(err, data) {
					if (data.userSettings.hasOwnProperty('sendPostNotifications') && data.userSettings.sendPostNotifications) {
						emailer.send('notif_post', toUid, {
							pid: postData.pid,
							subject: '[' + (meta.config.title || 'NodeBB') + '] ' + title,
							intro: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + title + ']]',
							postBody: postData.content,
							site_title: meta.config.title || 'NodeBB',
							username: data.userData.username,
							url: nconf.get('url') + '/topic/' + postData.topic.tid,
							base_url: nconf.get('url')
						}, next);
					} else {
						winston.debug('[topics.notifyFollowers] uid ' + toUid + ' does not have post notifications enabled, skipping.');
					}
				});
			});
		});
	};
};