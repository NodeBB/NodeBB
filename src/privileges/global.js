
'use strict';

var async = require('async');
var _ = require('lodash');

var user = require('../user');
var groups = require('../groups');
var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.global = {};

	privileges.global.privilegeLabels = [
		{ name: 'Chat' },
	];

	privileges.global.userPrivilegeList = [
		'chat',
	];

	privileges.global.groupPrivilegeList = privileges.global.userPrivilegeList.map(function (privilege) {
		return 'groups:' + privilege;
	});

	privileges.global.list = function (callback) {
		var privilegeLabels = privileges.global.privilegeLabels.slice();
		var userPrivilegeList = privileges.global.userPrivilegeList.slice();
		var groupPrivilegeList = privileges.global.groupPrivilegeList.slice();

		async.waterfall([
			function (next) {
				async.parallel({
					labels: function (next) {
						async.parallel({
							users: async.apply(plugins.fireHook, 'filter:privileges.global.list_human', privilegeLabels),
							groups: async.apply(plugins.fireHook, 'filter:privileges.global.groups.list_human', privilegeLabels),
						}, next);
					},
					users: function (next) {
						var userPrivileges;
						var memberSets;
						async.waterfall([
							async.apply(plugins.fireHook, 'filter:privileges.global.list', userPrivilegeList),
							function (_privs, next) {
								userPrivileges = _privs;
								groups.getMembersOfGroups(userPrivileges.map(function (privilege) {
									return 'cid:0:privileges:' + privilege;
								}), next);
							},
							function (_memberSets, next) {
								memberSets = _memberSets.map(function (set) {
									return set.map(function (uid) {
										return parseInt(uid, 10);
									});
								});

								var members = _.uniq(_.flatten(memberSets));

								user.getUsersFields(members, ['picture', 'username'], next);
							},
							function (memberData, next) {
								memberData.forEach(function (member) {
									member.privileges = {};
									for (var x = 0, numPrivs = userPrivileges.length; x < numPrivs; x += 1) {
										member.privileges[userPrivileges[x]] = memberSets[x].indexOf(parseInt(member.uid, 10)) !== -1;
									}
								});

								next(null, memberData);
							},
						], next);
					},
					groups: function (next) {
						var groupPrivileges;
						async.waterfall([
							async.apply(plugins.fireHook, 'filter:privileges.global.groups.list', groupPrivilegeList),
							function (_privs, next) {
								groupPrivileges = _privs;
								async.parallel({
									memberSets: function (next) {
										groups.getMembersOfGroups(groupPrivileges.map(function (privilege) {
											return 'cid:0:privileges:' + privilege;
										}), next);
									},
									groupNames: function (next) {
										groups.getGroups('groups:createtime', 0, -1, next);
									},
								}, next);
							},
							function (results, next) {
								var memberSets = results.memberSets;
								var uniqueGroups = _.uniq(_.flatten(memberSets));

								var groupNames = results.groupNames.filter(function (groupName) {
									return groupName.indexOf(':privileges:') === -1 && uniqueGroups.indexOf(groupName) !== -1;
								});

								var registeredUsersIndex = groupNames.indexOf('registered-users');
								if (registeredUsersIndex !== -1) {
									groupNames.splice(0, 0, groupNames.splice(registeredUsersIndex, 1)[0]);
								} else {
									groupNames = ['registered-users'].concat(groupNames);
								}

								var adminIndex = groupNames.indexOf('administrators');
								if (adminIndex !== -1) {
									groupNames.splice(adminIndex, 1);
								}

								var memberPrivs;

								var memberData = groupNames.map(function (member) {
									memberPrivs = {};

									for (var x = 0, numPrivs = groupPrivileges.length; x < numPrivs; x += 1) {
										memberPrivs[groupPrivileges[x]] = memberSets[x].indexOf(member) !== -1;
									}
									return {
										name: member,
										privileges: memberPrivs,
									};
								});

								next(null, memberData);
							},
							function (memberData, next) {
								// Grab privacy info for the groups as well
								async.map(memberData, function (member, next) {
									async.waterfall([
										function (next) {
											groups.isPrivate(member.name, next);
										},
										function (isPrivate, next) {
											member.isPrivate = isPrivate;
											next(null, member);
										},
									], next);
								}, next);
							},
						], next);
					},
				}, next);
			},
			function (payload, next) {
				// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
				payload.columnCount = payload.labels.users.length + 2;
				next(null, payload);
			},
		], callback);
	};

	privileges.global.can = function (privilege, uid, callback) {
		helpers.some([
			function (next) {
				helpers.isUserAllowedTo(privilege, uid, [0], function (err, results) {
					next(err, Array.isArray(results) && results.length ? results[0] : false);
				});
			},
			function (next) {
				user.isGlobalModerator(uid, next);
			},
			function (next) {
				user.isAdministrator(uid, next);
			},
		], callback);
	};


};
