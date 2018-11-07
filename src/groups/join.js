'use strict';

const async = require('async');
const winston = require('winston');

const db = require('../database');
const user = require('../user');
const plugins = require('../plugins');

module.exports = function (Groups) {
	Groups.join = function (groupNames, uid, callback) {
		callback = callback || function () {};

		if (!groupNames) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}

		if (!uid) {
			return callback(new Error('[[error:invalid-uid]]'));
		}
		var isAdmin;
		async.waterfall([
			function (next) {
				async.parallel({
					isMembers: async.apply(Groups.isMemberOfGroups, uid, groupNames),
					exists: async.apply(Groups.exists, groupNames),
					isAdmin: async.apply(user.isAdministrator, uid),
				}, next);
			},
			function (results, next) {
				isAdmin = results.isAdmin;

				var groupsToCreate = groupNames.filter(function (groupName, index) {
					return groupName && !results.exists[index];
				});

				groupNames = groupNames.filter(function (groupName, index) {
					return !results.isMembers[index];
				});

				if (!groupNames.length) {
					return callback();
				}

				createNonExistingGroups(groupsToCreate, next);
			},
			function (next) {
				var tasks = [
					async.apply(db.sortedSetsAdd, groupNames.map(groupName => 'group:' + groupName + ':members'), Date.now(), uid),
					async.apply(db.incrObjectField, groupNames.map(groupName => 'group:' + groupName), 'memberCount'),
				];
				if (isAdmin) {
					tasks.push(async.apply(db.setsAdd, groupNames.map(groupName => 'group:' + groupName + ':owners'), uid));
				}

				async.parallel(tasks, next);
			},
			function (results, next) {
				Groups.clearCache(uid, groupNames);
				Groups.getGroupsFields(groupNames, ['name', 'hidden', 'memberCount'], next);
			},
			function (groupData, next) {
				var visibleGroups = groupData.filter(groupData => groupData && !groupData.hidden);

				if (visibleGroups.length) {
					db.sortedSetAdd('groups:visible:memberCount', visibleGroups.map(groupData => groupData.memberCount), visibleGroups.map(groupData => groupData.name), next);
				} else {
					next();
				}
			},
			function (next) {
				setGroupTitleIfNotSet(groupNames, uid, next);
			},
			function (next) {
				plugins.fireHook('action:group.join', {
					groupNames: groupNames,
					uid: uid,
				});
				next();
			},
		], callback);
	};

	function createNonExistingGroups(groupsToCreate, callback) {
		if (!groupsToCreate.length) {
			return setImmediate(callback);
		}
		async.eachSeries(groupsToCreate, function (groupName, next) {
			Groups.create({
				name: groupName,
				hidden: 1,
			}, function (err) {
				if (err && err.message !== '[[error:group-already-exists]]') {
					winston.error('[groups.join] Could not create new hidden group', err);
					return next(err);
				}
				next();
			});
		}, callback);
	}

	function setGroupTitleIfNotSet(groupNames, uid, callback) {
		groupNames = groupNames.filter(function (groupName) {
			return groupName !== 'registered-users' && !Groups.isPrivilegeGroup(groupName);
		});
		if (!groupNames.length) {
			return callback();
		}

		db.getObjectField('user:' + uid, 'groupTitle', function (err, currentTitle) {
			if (err || currentTitle || currentTitle === '') {
				return callback(err);
			}

			user.setUserField(uid, 'groupTitle', JSON.stringify(groupNames), callback);
		});
	}
};
