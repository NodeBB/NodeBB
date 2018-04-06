'use strict';

var async = require('async');
var validator = require('validator');
var _ = require('lodash');

var user = require('../user');
var groups = require('../groups');
var meta = require('../meta');
var plugins = require('../plugins');
var privileges = require('../privileges');

module.exports = function (Posts) {
	Posts.getUserInfoForPosts = function (uids, uid, callback) {
		var groupsMap = {};
		var userData;
		var userSettings;
		var canUseSignature;

		async.waterfall([
			function (next) {
				async.parallel({
					userData: function (next) {
						user.getUsersFields(uids, [
							'uid', 'username', 'fullname', 'userslug',
							'reputation', 'postcount', 'picture', 'signature',
							'banned', 'status', 'lastonline', 'groupTitle',
						], next);
					},
					userSettings: function (next) {
						user.getMultipleUserSettings(uids, next);
					},
					canUseSignature: function (next) {
						privileges.global.can('signature', uid, next);
					},
				}, next);
			},
			function (results, next) {
				userData = results.userData;
				userSettings = results.userSettings;
				canUseSignature = results.canUseSignature;
				var groupTitles = userData.map(function (userData) {
					return userData && userData.groupTitleArray;
				});
				groupTitles = _.uniq(_.flatten(groupTitles));

				groups.getGroupsData(groupTitles, next);
			},
			function (groupsData, next) {
				groupsData.forEach(function (group) {
					if (group && group.userTitleEnabled && !group.hidden) {
						groupsMap[group.name] = {
							name: group.name,
							slug: group.slug,
							labelColor: group.labelColor,
							icon: group.icon,
							userTitle: group.userTitle,
						};
					}
				});

				userData.forEach(function (userData, index) {
					userData.uid = userData.uid || 0;
					userData.username = userData.username || '[[global:guest]]';
					userData.userslug = userData.userslug || '';
					userData.reputation = userData.reputation || 0;
					userData.postcount = userData.postcount || 0;
					userData.banned = parseInt(userData.banned, 10) === 1;
					userData.picture = userData.picture || '';
					userData.status = user.getStatus(userData);
					userData.signature = validator.escape(String(userData.signature || ''));
					userData.fullname = userSettings[index].showfullname ? validator.escape(String(userData.fullname || '')) : undefined;
					userData.selectedGroups = [];

					if (parseInt(meta.config.hideFullname, 10) === 1) {
						userData.fullname = undefined;
					}
				});

				async.map(userData, function (userData, next) {
					async.waterfall([
						function (next) {
							async.parallel({
								isMemberOfGroups: function (next) {
									if (!Array.isArray(userData.groupTitleArray) || !userData.groupTitleArray.length) {
										return next();
									}
									groups.isMemberOfGroups(userData.uid, userData.groupTitleArray, next);
								},
								signature: function (next) {
									if (!userData.signature || !canUseSignature || parseInt(meta.config.disableSignatures, 10) === 1) {
										userData.signature = '';
										return next();
									}
									Posts.parseSignature(userData, uid, next);
								},
								customProfileInfo: function (next) {
									plugins.fireHook('filter:posts.custom_profile_info', { profile: [], uid: userData.uid }, next);
								},
							}, next);
						},
						function (results, next) {
							if (results.isMemberOfGroups && userData.groupTitleArray) {
								userData.groupTitleArray.forEach(function (userGroup, index) {
									if (results.isMemberOfGroups[index] && groupsMap[userGroup]) {
										userData.selectedGroups.push(groupsMap[userGroup]);
									}
								});
							}

							userData.custom_profile_info = results.customProfileInfo.profile;

							plugins.fireHook('filter:posts.modifyUserInfo', userData, next);
						},
					], next);
				}, next);
			},
		], callback);
	};

	Posts.isOwner = function (pid, uid, callback) {
		uid = parseInt(uid, 10);
		if (Array.isArray(pid)) {
			if (!uid) {
				return callback(null, pid.map(function () { return false; }));
			}
			Posts.getPostsFields(pid, ['uid'], function (err, posts) {
				if (err) {
					return callback(err);
				}
				posts = posts.map(function (post) {
					return post && parseInt(post.uid, 10) === uid;
				});
				callback(null, posts);
			});
		} else {
			if (!uid) {
				return callback(null, false);
			}
			Posts.getPostField(pid, 'uid', function (err, author) {
				callback(err, parseInt(author, 10) === uid);
			});
		}
	};

	Posts.isModerator = function (pids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, pids.map(function () { return false; }));
		}
		Posts.getCidsByPids(pids, function (err, cids) {
			if (err) {
				return callback(err);
			}
			user.isModerator(uid, cids, callback);
		});
	};
};
