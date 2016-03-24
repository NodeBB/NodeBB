'use strict';

var async = require('async'),
	validator = require('validator'),

	db = require('../database'),
	user = require('../user'),
	groups = require('../groups'),
	meta = require('../meta'),
	plugins = require('../plugins');


module.exports = function(Posts) {

	Posts.getUserInfoForPosts = function(uids, uid, callback) {
		var groupsMap = {};
		var userSettings;
		async.parallel({
			groupTitles: function(next) {
				var keys = uids.map(function(uid) {
					return 'user:' + uid + ':settings';
				});
				async.waterfall([
					function (next) {
						db.getObjectsFields(keys, ['groupTitle'], next);
					},
					function (_userSettings, next) {
						userSettings = _userSettings;
						var groupKeys = userSettings.filter(function(userSetting) {
							return userSetting && userSetting.groupTitle;
						}).map(function(userSetting) {
							return userSetting.groupTitle;
						}).filter(function(groupTitle, index, array) {
							return groupTitle && array.indexOf(groupTitle) === index;
						});
						groups.getGroupsData(groupKeys, next);
					},
					function (groupsData, next) {
						groupsData.forEach(function(group) {
							if (group && group.userTitleEnabled) {
								groupsMap[group.name] = {
									name: group.name,
									slug: group.slug,
									labelColor: group.labelColor,
									icon: group.icon,
									userTitle: group.userTitle
								};
							}
						});
						next(null, userSettings);
					}
				], next);
			},
			userData: function(next) {
				user.getUsersFields(uids, ['uid', 'username', 'fullname', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status', 'lastonline'], next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var userData = results.userData;
			userData.forEach(function(userData, i) {
				userData.uid = userData.uid || 0;
				userData.username = userData.username || '[[global:guest]]';
				userData.userslug = userData.userslug || '';
				userData.reputation = userData.reputation || 0;
				userData.postcount = userData.postcount || 0;
				userData.banned = parseInt(userData.banned, 10) === 1;
				userData.picture = userData.picture || '';
				userData.status = user.getStatus(userData);
				userData.groupTitle = results.groupTitles[i].groupTitle;
				userData.signature = validator.escape(userData.signature || '');
				userData.fullname = validator.escape(userData.fullname || '');
			});

			async.map(userData, function(userData, next) {
				async.parallel({
					isMemberOfGroup: function (next) {
						if (!userData.groupTitle) {
							return next();
						}
						groups.isMember(userData.uid, userData.groupTitle, next);
					},
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

					if (results.isMemberOfGroup && userData.groupTitle && groupsMap[userData.groupTitle]) {
						userData.selectedGroup = groupsMap[userData.groupTitle];
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