
'use strict';

var async = require('async'),
	nconf = require('nconf'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	notifications = require('../notifications');

module.exports = function(Topics) {


	Topics.isFollowing = function(tid, uid, callback) {
		db.isSetMember('tid:' + tid + ':followers', uid, callback);
	};

	Topics.getFollowers = function(tid, callback) {
		db.getSetMembers('tid:' + tid + ':followers', callback);
	};

	Topics.notifyFollowers = function(tid, pid, exceptUid) {
		async.parallel({
			nid: function(next) {
				async.parallel({
					topicData: async.apply(Topics.getTopicFields, tid, ['title', 'slug']),
					username: async.apply(user.getUserField, exceptUid, 'username'),
					postIndex: async.apply(posts.getPidIndex, pid),
					postContent: async.apply(posts.getPostField, pid, 'content')
				}, function(err, results) {
					if (err) {
						return next(err);
					}

					notifications.create({
						body: {
							short: '[[notifications:user_posted_to, ' + results.username + ', ' + results.topicData.title + ']]',
							long: results.postContent
						},
						path: nconf.get('relative_path') + '/topic/' + results.topicData.slug + '/' + results.postIndex,
						uniqueId: 'topic:' + tid,
						from: exceptUid
					}, function(nid) {
						next(null, nid);
					});
				});
			},
			followers: function(next) {
				Topics.getFollowers(tid, next);
			}
		}, function(err, results) {
			if (!err && results.followers.length) {

				var index = results.followers.indexOf(exceptUid.toString());
				if (index !== -1) {
					results.followers.splice(index, 1);
				}

				notifications.push(results.nid, results.followers);
			}
		});
	};

};