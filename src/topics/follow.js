
'use strict';

var async = require('async'),
	nconf = require('nconf'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	postTools = require('../postTools'),
	notifications = require('../notifications');

module.exports = function(Topics) {


	Topics.isFollowing = function(tid, uid, callback) {
		db.isSetMember('tid:' + tid + ':followers', uid, callback);
	};

	Topics.getFollowers = function(tid, callback) {
		db.getSetMembers('tid:' + tid + ':followers', callback);
	};

	Topics.notifyFollowers = function(topicData, postData, exceptUid) {
		Topics.getFollowers(topicData.tid, function(err, followers) {
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

			notifications.create({
				bodyShort: '[[notifications:user_posted_to, ' + postData.user.username + ', ' + topicData.title + ']]',
				bodyLong: postData.content,
				pid: postData.pid,
				nid: 'tid:' + topicData.tid + ':pid:' + postData.pid + ':uid:' + exceptUid,
				tid: topicData.tid,
				from: exceptUid
			}, function(err, notification) {
				if (!err && notification) {
					notifications.push(notification, followers);
				}
			});
		});
	};
};