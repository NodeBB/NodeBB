
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
					topicData: function(next) {
						Topics.getTopicFields(tid, ['title', 'slug'], next);
					},
					username: function(next) {
						user.getUserField(exceptUid, 'username', next);
					},
					postIndex: function(next) {
						posts.getPidIndex(pid, next);
					}
				}, function(err, results) {
					if (err) {
						return next(err);
					}

					var path = nconf.get('relative_path') + '/topic/' + results.topicData.slug;
					if (parseInt(results.postIndex, 10)) {
						path += '/' + (parseInt(results.postIndex, 10) + 1);
					}
					notifications.create({
						text: '[[notifications:user_posted_to, ' + results.username + ', ' + results.topicData.title + ']]',
						path: path,
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