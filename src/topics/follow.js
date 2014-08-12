
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
				topicData: async.apply(Topics.getTopicFields, tid, ['title', 'slug']),
				username: async.apply(user.getUserField, exceptUid, 'username'),
				postIndex: async.apply(posts.getPidIndex, pid),
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
					bodyShort: '[[notifications:user_posted_to, ' + results.username + ', ' + results.topicData.title + ']]',
					bodyLong: results.postContent,
					path: nconf.get('relative_path') + '/topic/' + results.topicData.slug + '/' + results.postIndex,
					uniqueId: 'topic:' + tid + ':uid:' + exceptUid,
					tid: tid,
					from: exceptUid
				}, function(err, nid) {
					if (!err) {
						notifications.push(nid, followers);
					}
				});
			});
		});
	};
};