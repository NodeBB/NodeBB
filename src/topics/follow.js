
'use strict';

var async = require('async'),
	nconf = require('nconf'),

	db = require('../database'),
	user = require('../user'),
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
				Topics.getTopicFields(tid, ['title', 'slug'], function(err, topicData) {
					if(err) {
						return next(err);
					}

					user.getUserField(exceptUid, 'username', function(err, username) {
						if(err) {
							return next(err);
						}

						notifications.create({
							text: '[[notifications:user_posted_to, ' + username + ', ' + topicData.title + ']]',
							path: nconf.get('relative_path') + '/topic/' + topicData.slug + '#' + pid,
							uniqueId: 'topic:' + tid,
							from: exceptUid
						}, function(nid) {
							next(null, nid);
						});
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