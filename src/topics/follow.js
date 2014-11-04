
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	S = require('string'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	postTools = require('../postTools'),
	notifications = require('../notifications');

module.exports = function(Topics) {


	Topics.isFollowing = function(tid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, false);
		}
		db.isSetMember('tid:' + tid + ':followers', uid, callback);
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
		});
	};
};