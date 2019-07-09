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
	Posts.getUserInfoForPosts = async function (uids, uid) {
		const [userData, userSettings, canUseSignature] = await Promise.all([
			getUserData(uids, uid),
			user.getMultipleUserSettings(uids),
			privileges.global.can('signature', uid),
		]);

		var groupTitles = _.uniq(_.flatten(userData.map(u => u && u.groupTitleArray)));
		const groupsMap = {};
		const groupsData = await groups.getGroupsData(groupTitles);
		groupsData.forEach(function (group) {
			if (group && group.userTitleEnabled && !group.hidden) {
				groupsMap[group.name] = {
					name: group.name,
					slug: group.slug,
					labelColor: group.labelColor,
					textColor: group.textColor,
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
			userData.banned = userData.banned === 1;
			userData.picture = userData.picture || '';
			userData.status = user.getStatus(userData);
			userData.signature = validator.escape(String(userData.signature || ''));
			userData.fullname = userSettings[index].showfullname ? validator.escape(String(userData.fullname || '')) : undefined;
			userData.selectedGroups = [];

			if (meta.config.hideFullname) {
				userData.fullname = undefined;
			}
		});

		return await async.map(userData, async function (userData) {
			const results = await async.parallel({
				isMemberOfGroups: function (next) {
					if (!Array.isArray(userData.groupTitleArray) || !userData.groupTitleArray.length) {
						return next();
					}
					groups.isMemberOfGroups(userData.uid, userData.groupTitleArray, next);
				},
				signature: function (next) {
					if (!userData.signature || !canUseSignature || meta.config.disableSignatures) {
						userData.signature = '';
						return next();
					}
					Posts.parseSignature(userData, uid, next);
				},
				customProfileInfo: function (next) {
					plugins.fireHook('filter:posts.custom_profile_info', { profile: [], uid: userData.uid }, next);
				},
			});

			if (results.isMemberOfGroups && userData.groupTitleArray) {
				userData.groupTitleArray.forEach(function (userGroup, index) {
					if (results.isMemberOfGroups[index] && groupsMap[userGroup]) {
						userData.selectedGroups.push(groupsMap[userGroup]);
					}
				});
			}

			userData.custom_profile_info = results.customProfileInfo.profile;

			const result = await plugins.fireHook('filter:posts.modifyUserInfo', userData);
			return result;
		});
	};

	async function getUserData(uids, uid) {
		const fields = [
			'uid', 'username', 'fullname', 'userslug',
			'reputation', 'postcount', 'topiccount', 'picture',
			'signature', 'banned', 'banned:expire', 'status',
			'lastonline', 'groupTitle',
		];
		const result = await plugins.fireHook('filter:posts.addUserFields', {
			fields: fields,
			uid: uid,
			uids: uids,
		});
		return await user.getUsersFields(result.uids, _.uniq(result.fields));
	}

	Posts.isOwner = async function (pids, uid) {
		uid = parseInt(uid, 10);
		const isArray = Array.isArray(pids);
		pids = isArray ? pids : [pids];
		if (uid <= 0) {
			return isArray ? pids.map(() => false) : false;
		}
		const postData = await Posts.getPostsFields(pids, ['uid']);
		const result = postData.map(post => post && post.uid === uid);
		return isArray ? result : result[0];
	};

	Posts.isModerator = async function (pids, uid) {
		if (parseInt(uid, 10) <= 0) {
			return pids.map(() => false);
		}
		const cids = await Posts.getCidsByPids(pids);
		return await user.isModerator(uid, cids);
	};
};
