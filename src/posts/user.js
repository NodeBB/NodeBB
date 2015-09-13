'use strict';

var async = require('async'),

	db = require('../database'),
	user = require('../user'),
	groups = require('../groups'),
	meta = require('../meta'),
	plugins = require('../plugins');


module.exports = function(Posts) {

	Posts.getUserInfoForPosts = function(uids, uid, callback) {
		async.parallel({
			groups: function(next) {
				groups.getUserGroups(uids, next);
			},
			userSettings: function(next){
				user.getMultipleUserSettings(uids, next);
			},
			userData: function(next) {
				user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status'], next);
			},
			online: function(next) {
				require('../socket.io').isUsersOnline(uids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var userData = results.userData;
			userData.forEach(function(userData, i) {
				userData.groups = [];

				results.groups[i].forEach(function(group, index) {
					userData.groups[index] = {
						name: group.name,
						slug: group.slug,
						labelColor: group.labelColor,
						icon: group.icon,
						userTitle: group.userTitle,
						userTitleEnabled: group.userTitleEnabled,
						selected: group.name === results.userSettings[i].groupTitle
					};
				});
				userData.status = user.getStatus(userData.status, results.online[i]);
			});

			async.map(userData, function(userData, next) {
				userData.uid = userData.uid || 0;
				userData.username = userData.username || '[[global:guest]]';
				userData.userslug = userData.userslug || '';
				userData.reputation = userData.reputation || 0;
				userData.postcount = userData.postcount || 0;
				userData.banned = parseInt(userData.banned, 10) === 1;
				userData.picture = userData.picture || user.createGravatarURLFromEmail('');

				async.parallel({
					signature: function(next) {
						if (!userData.signature || parseInt(meta.config.disableSignatures, 10) === 1) {
							userData.signature = '';
							return next();
						}
						Posts.parseSignature(userData, uid, next);
					},
					customProfileInfo: function(next) {
						plugins.fireHook('filter:posts.custom_profile_info', {profile: [], uid: userData.uid}, next);
					}
				}, function(err, results) {
					if (err) {
						return next(err);
					}

					userData.custom_profile_info = results.customProfileInfo.profile;
					userData.signature = sanitizeSignature(userData.signature);

					plugins.fireHook('filter:posts.modifyUserInfo', userData, next);
				});
			}, callback);
		});
	};

	Posts.isOwner = function(pid, uid, callback) {
		uid = parseInt(uid, 10);
		if (Array.isArray(pid)) {
			if (!uid) {
				return callback(null, pid.map(function() {return false;}));
			}
			Posts.getPostsFields(pid, ['uid'], function(err, posts) {
				if (err) {
					return callback(err);
				}
				posts = posts.map(function(post) {
					return post && parseInt(post.uid, 10) === uid;
				});
				callback(null, posts);
			});
		} else {
			if (!uid) {
				return callback(null, false);
			}
			Posts.getPostField(pid, 'uid', function(err, author) {
				callback(err, parseInt(author, 10) === uid);
			});
		}
	};

	Posts.isModerator = function(pids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, pids.map(function() {return false;}));
		}
		Posts.getCidsByPids(pids, function(err, cids) {
			if (err) {
				return callback(err);
			}
			user.isModerator(uid, cids, callback);
		});
	};
};

function sanitizeSignature(signature) {
	var	string = require('string')(signature),
		tagsToStrip = [];

	if (parseInt(meta.config['signatures:disableLinks'], 10) === 1) {
		tagsToStrip.push('a');
	}

	if (parseInt(meta.config['signatures:disableImages'], 10) === 1) {
		tagsToStrip.push('img');
	}

	return tagsToStrip.length ? string.stripTags.apply(string, tagsToStrip).s : signature;
}