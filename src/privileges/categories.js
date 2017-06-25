
'use strict';

var async = require('async');
var _ = require('lodash');

var categories = require('../categories');
var user = require('../user');
var groups = require('../groups');
var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.categories = {};

	privileges.categories.list = function (cid, callback) {
		// Method used in admin/category controller to show all users/groups with privs in that given cid

		async.waterfall([
			function (next) {
				async.parallel({
					labels: function (next) {
						async.parallel({
							users: async.apply(plugins.fireHook, 'filter:privileges.list_human', privileges.privilegeLabels),
							groups: async.apply(plugins.fireHook, 'filter:privileges.groups.list_human', privileges.privilegeLabels),
						}, next);
					},
					users: function (next) {
						var userPrivileges;
						var memberSets;
						async.waterfall([
							async.apply(plugins.fireHook, 'filter:privileges.list', privileges.userPrivilegeList),
							function (_privs, next) {
								userPrivileges = _privs;
								groups.getMembersOfGroups(userPrivileges.map(function (privilege) {
									return 'cid:' + cid + ':privileges:' + privilege;
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
							async.apply(plugins.fireHook, 'filter:privileges.groups.list', privileges.groupPrivilegeList),
							function (_privs, next) {
								groupPrivileges = _privs;
								async.parallel({
									memberSets: function (next) {
										groups.getMembersOfGroups(groupPrivileges.map(function (privilege) {
											return 'cid:' + cid + ':privileges:' + privilege;
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

								groupNames = groups.ephemeralGroups.concat(groupNames);
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

	privileges.categories.get = function (cid, uid, callback) {
		var privs = ['topics:create', 'topics:read', 'topics:tag', 'read'];
		async.waterfall([
			function (next) {
				async.parallel({
					privileges: function (next) {
						helpers.isUserAllowedTo(privs, uid, cid, next);
					},
					isAdministrator: function (next) {
						user.isAdministrator(uid, next);
					},
					isModerator: function (next) {
						user.isModerator(uid, cid, next);
					},
				}, next);
			},
			function (results, next) {
				var privData = _.zipObject(privs, results.privileges);
				var isAdminOrMod = results.isAdministrator || results.isModerator;

				plugins.fireHook('filter:privileges.categories.get', {
					'topics:create': privData['topics:create'] || isAdminOrMod,
					'topics:read': privData['topics:read'] || isAdminOrMod,
					'topics:tag': privData['topics:tag'] || isAdminOrMod,
					read: privData.read || isAdminOrMod,
					cid: cid,
					uid: uid,
					editable: isAdminOrMod,
					view_deleted: isAdminOrMod,
					isAdminOrMod: isAdminOrMod,
				}, next);
			},
		], callback);
	};

	privileges.categories.isAdminOrMod = function (cid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, false);
		}
		helpers.some([
			function (next) {
				user.isModerator(uid, cid, next);
			},
			function (next) {
				user.isAdministrator(uid, next);
			},
		], callback);
	};

	privileges.categories.isUserAllowedTo = function (privilege, cid, uid, callback) {
		if (!cid) {
			return callback(null, false);
		}
		helpers.isUserAllowedTo(privilege, uid, [cid], function (err, results) {
			callback(err, Array.isArray(results) && results.length ? results[0] : false);
		});
	};

	privileges.categories.can = function (privilege, cid, uid, callback) {
		if (!cid) {
			return callback(null, false);
		}

		async.waterfall([
			function (next) {
				categories.getCategoryField(cid, 'disabled', next);
			},
			function (disabled, next) {
				if (parseInt(disabled, 10) === 1) {
					return callback(null, false);
				}
				helpers.some([
					function (next) {
						helpers.isUserAllowedTo(privilege, uid, [cid], function (err, results) {
							next(err, Array.isArray(results) && results.length ? results[0] : false);
						});
					},
					function (next) {
						user.isModerator(uid, cid, next);
					},
					function (next) {
						user.isAdministrator(uid, next);
					},
				], next);
			},
		], callback);
	};

	privileges.categories.filterCids = function (privilege, cids, uid, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}

		cids = cids.filter(function (cid, index, array) {
			return array.indexOf(cid) === index;
		});

		async.waterfall([
			function (next) {
				privileges.categories.getBase(privilege, cids, uid, next);
			},
			function (results, next) {
				cids = cids.filter(function (cid, index) {
					return !results.categories[index].disabled &&
						(results.allowedTo[index] || results.isAdmin || results.isModerators[index]);
				});

				next(null, cids.filter(Boolean));
			},
		], callback);
	};

	privileges.categories.getBase = function (privilege, cids, uid, callback) {
		async.parallel({
			categories: function (next) {
				categories.getCategoriesFields(cids, ['disabled'], next);
			},
			allowedTo: function (next) {
				helpers.isUserAllowedTo(privilege, uid, cids, next);
			},
			isModerators: function (next) {
				user.isModerator(uid, cids, next);
			},
			isAdmin: function (next) {
				user.isAdministrator(uid, next);
			},
		}, callback);
	};

	privileges.categories.filterUids = function (privilege, cid, uids, callback) {
		if (!uids.length) {
			return callback(null, []);
		}

		uids = _.uniq(uids);

		async.waterfall([
			function (next) {
				async.parallel({
					allowedTo: function (next) {
						helpers.isUsersAllowedTo(privilege, uids, cid, next);
					},
					isModerators: function (next) {
						user.isModerator(uids, cid, next);
					},
					isAdmins: function (next) {
						user.isAdministrator(uids, next);
					},
				}, next);
			},
			function (results, next) {
				uids = uids.filter(function (uid, index) {
					return results.allowedTo[index] || results.isModerators[index] || results.isAdmins[index];
				});
				next(null, uids);
			},
		], callback);
	};

	privileges.categories.give = function (privileges, cid, groupName, callback) {
		giveOrRescind(groups.join, privileges, cid, groupName, callback);
	};

	privileges.categories.rescind = function (privileges, cid, groupName, callback) {
		giveOrRescind(groups.leave, privileges, cid, groupName, callback);
	};

	function giveOrRescind(method, privileges, cid, groupName, callback) {
		async.each(privileges, function (privilege, next) {
			method('cid:' + cid + ':privileges:groups:' + privilege, groupName, next);
		}, callback);
	}

	privileges.categories.canMoveAllTopics = function (currentCid, targetCid, uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					isAdministrator: function (next) {
						user.isAdministrator(uid, next);
					},
					moderatorOfCurrent: function (next) {
						user.isModerator(uid, currentCid, next);
					},
					moderatorOfTarget: function (next) {
						user.isModerator(uid, targetCid, next);
					},
				}, next);
			},
			function (results, next) {
				next(null, results.isAdministrator || (results.moderatorOfCurrent && results.moderatorOfTarget));
			},
		], callback);
	};

	privileges.categories.userPrivileges = function (cid, uid, callback) {
		var tasks = {};

		privileges.userPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = async.apply(groups.isMember, uid, 'cid:' + cid + ':privileges:' + privilege);
		});

		async.parallel(tasks, callback);
	};

	privileges.categories.groupPrivileges = function (cid, groupName, callback) {
		var tasks = {};

		privileges.groupPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = async.apply(groups.isMember, groupName, 'cid:' + cid + ':privileges:' + privilege);
		});

		async.parallel(tasks, callback);
	};
};
