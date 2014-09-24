
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

	Topics.notifyFollowers = function(tid, pid, exceptUid) {
		Topics.getFollowers(tid, function(err, followers) {
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

			async.parallel({
				title: async.apply(Topics.getTopicField, tid, 'title'),
				username: async.apply(user.getUserField, exceptUid, 'username'),
				postContent: function(next) {
					async.waterfall([
						async.apply(posts.getPostField, pid, 'content'),
						function(content, next) {
							postTools.parse(content, next);
						}
					], next);
				}
			}, function(err, results) {
				if (err) {
					return;
				}

				notifications.create({
					bodyShort: '[[notifications:user_posted_to, ' + results.username + ', ' + results.title + ']]',
					bodyLong: results.postContent,
					pid: pid,
					nid: 'tid:' + tid + ':pid:' + pid + ':uid:' + exceptUid,
					tid: tid,
					from: exceptUid
				}, function(err, notification) {
					if (!err && notification) {
						notifications.push(notification, followers);
					}
				});
			});
		});
	};
};