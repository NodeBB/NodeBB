'use strict';

const async = require('async');

const db = require('../database');
const user = require('../user');
const plugins = require('../plugins');

module.exports = function (Groups) {
	Groups.leave = function (groupNames, uid, callback) {
		callback = callback || function () {};

		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}

		async.waterfall([
			function (next) {
				async.parallel({
					isMembers: async.apply(Groups.isMemberOfGroups, uid, groupNames),
					exists: async.apply(Groups.exists, groupNames),
				}, next);
			},
			function (result, next) {
				groupNames = groupNames.filter(function (groupName, index) {
					return result.isMembers[index] && result.exists[index];
				});

				if (!groupNames.length) {
					return callback();
				}

				async.parallel([
					async.apply(db.sortedSetRemove, groupNames.map(groupName => 'group:' + groupName + ':members'), uid),
					async.apply(db.setRemove, groupNames.map(groupName => 'group:' + groupName + ':owners'), uid),
					async.apply(db.decrObjectField, groupNames.map(groupName => 'group:' + groupName), 'memberCount'),
				], next);
			},
			function (results, next) {
				Groups.clearCache(uid, groupNames);
				Groups.getGroupsFields(groupNames, ['name', 'hidden', 'memberCount'], next);
			},
			function (groupData, next) {
				if (!groupData) {
					return callback();
				}
				var tasks = [];

				var emptyPrivilegeGroups = groupData.filter(function (groupData) {
					return groupData && Groups.isPrivilegeGroup(groupData.name) && groupData.memberCount === 0;
				});
				if (emptyPrivilegeGroups.length) {
					tasks.push(async.apply(Groups.destroy, emptyPrivilegeGroups));
				}

				var visibleGroups = groupData.filter(groupData => groupData && !groupData.hidden);
				if (visibleGroups.length) {
					tasks.push(async.apply(db.sortedSetAdd, 'groups:visible:memberCount', visibleGroups.map(groupData => groupData.memberCount), visibleGroups.map(groupData => groupData.name)));
				}

				async.parallel(tasks, function (err) {
					next(err);
				});
			},
			function (next) {
				clearGroupTitleIfSet(groupNames, uid, next);
			},
			function (next) {
				plugins.fireHook('action:group.leave', {
					groupNames: groupNames,
					uid: uid,
				});
				next();
			},
		], callback);
	};

	function clearGroupTitleIfSet(groupNames, uid, callback) {
		groupNames = groupNames.filter(function (groupName) {
			return groupName !== 'registered-users' && !Groups.isPrivilegeGroup(groupName);
		});
		if (!groupNames.length) {
			return callback();
		}
		async.waterfall([
			function (next) {
				user.getUserData(uid, next);
			},
			function (userData, next) {
				var newTitleArray = userData.groupTitleArray.filter(function (groupTitle) {
					return !groupNames.includes(groupTitle);
				});

				if (newTitleArray.length) {
					db.setObjectField('user:' + uid, 'groupTitle', JSON.stringify(newTitleArray), next);
				} else {
					db.deleteObjectField('user:' + uid, 'groupTitle', next);
				}
			},
		], callback);
	}

	Groups.leaveAllGroups = function (uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('groups:createtime', 0, -1, next);
			},
			function (groups, next) {
				async.parallel([
					function (next) {
						Groups.leave(groups, uid, next);
					},
					function (next) {
						Groups.rejectMembership(groups, uid, next);
					},
				], next);
			},
		], callback);
	};
};
