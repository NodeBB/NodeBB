'use strict';

var async = require('async');
var winston = require('winston');
var _ = require('lodash');

var user = require('../user');
var utils = require('../utils');
var plugins = require('../plugins');
var notifications = require('../notifications');
var db = require('../database');

var pubsub = require('../pubsub');
var LRU = require('lru-cache');

var cache = LRU({
	max: 40000,
	maxAge: 0,
});

module.exports = function (Groups) {
	Groups.cache = cache;

	Groups.join = function (groupName, uid, callback) {
		callback = callback || function () {};

		if (!groupName) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		if (!uid) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		async.waterfall([
			function (next) {
				Groups.isMember(uid, groupName, next);
			},
			function (isMember, next) {
				if (isMember) {
					return callback();
				}
				Groups.exists(groupName, next);
			},
			function (exists, next) {
				if (exists) {
					return next();
				}
				Groups.create({
					name: groupName,
					description: '',
					hidden: 1,
				}, function (err) {
					if (err && err.message !== '[[error:group-already-exists]]') {
						winston.error('[groups.join] Could not create new hidden group', err);
						return callback(err);
					}
					next();
				});
			},
			function (next) {
				async.parallel({
					isAdmin: function (next) {
						user.isAdministrator(uid, next);
					},
					isHidden: function (next) {
						Groups.isHidden(groupName, next);
					},
				}, next);
			},
			function (results, next) {
				var tasks = [
					async.apply(db.sortedSetAdd, 'group:' + groupName + ':members', Date.now(), uid),
					async.apply(db.incrObjectField, 'group:' + groupName, 'memberCount'),
				];
				if (results.isAdmin) {
					tasks.push(async.apply(db.setAdd, 'group:' + groupName + ':owners', uid));
				}
				if (!results.isHidden) {
					tasks.push(async.apply(db.sortedSetIncrBy, 'groups:visible:memberCount', 1, groupName));
				}
				async.parallel(tasks, next);
			},
			function (results, next) {
				clearCache(uid, groupName);
				setGroupTitleIfNotSet(groupName, uid, next);
			},
			function (next) {
				plugins.fireHook('action:group.join', {
					groupName: groupName,
					uid: uid,
				});
				next();
			},
		], callback);
	};

	function setGroupTitleIfNotSet(groupName, uid, callback) {
		if (groupName === 'registered-users' || Groups.isPrivilegeGroup(groupName)) {
			return callback();
		}

		db.getObjectField('user:' + uid, 'groupTitle', function (err, currentTitle) {
			if (err || (currentTitle || currentTitle === '')) {
				return callback(err);
			}

			user.setUserField(uid, 'groupTitle', JSON.stringify([groupName]), callback);
		});
	}

	Groups.requestMembership = function (groupName, uid, callback) {
		async.waterfall([
			async.apply(inviteOrRequestMembership, groupName, uid, 'request'),
			function (next) {
				user.getUserField(uid, 'username', next);
			},
			function (username, next) {
				async.parallel({
					notification: function (next) {
						notifications.create({
							bodyShort: '[[groups:request.notification_title, ' + username + ']]',
							bodyLong: '[[groups:request.notification_text, ' + username + ', ' + groupName + ']]',
							nid: 'group:' + groupName + ':uid:' + uid + ':request',
							path: '/groups/' + utils.slugify(groupName),
							from: uid,
						}, next);
					},
					owners: function (next) {
						Groups.getOwners(groupName, next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.notification || !results.owners.length) {
					return next();
				}
				notifications.push(results.notification, results.owners, next);
			},
		], callback);
	};

	Groups.acceptMembership = function (groupName, uid, callback) {
		async.waterfall([
			async.apply(db.setsRemove, ['group:' + groupName + ':pending', 'group:' + groupName + ':invited'], uid),
			async.apply(Groups.join, groupName, uid),
		], callback);
	};

	Groups.rejectMembership = function (groupNames, uid, callback) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}
		var sets = [];
		groupNames.forEach(function (groupName) {
			sets.push('group:' + groupName + ':pending', 'group:' + groupName + ':invited');
		});

		db.setsRemove(sets, uid, callback);
	};

	Groups.invite = function (groupName, uid, callback) {
		async.waterfall([
			async.apply(inviteOrRequestMembership, groupName, uid, 'invite'),
			async.apply(notifications.create, {
				type: 'group-invite',
				bodyShort: '[[groups:invited.notification_title, ' + groupName + ']]',
				bodyLong: '',
				nid: 'group:' + groupName + ':uid:' + uid + ':invite',
				path: '/groups/' + utils.slugify(groupName),
			}),
			function (notification, next) {
				notifications.push(notification, [uid], next);
			},
		], callback);
	};

	function inviteOrRequestMembership(groupName, uid, type, callback) {
		if (!parseInt(uid, 10)) {
			return callback(new Error('[[error:not-logged-in]]'));
		}
		var hookName = type === 'invite' ? 'action:group.inviteMember' : 'action:group.requestMembership';
		var set = type === 'invite' ? 'group:' + groupName + ':invited' : 'group:' + groupName + ':pending';

		async.waterfall([
			function (next) {
				async.parallel({
					exists: async.apply(Groups.exists, groupName),
					isMember: async.apply(Groups.isMember, uid, groupName),
					isPending: async.apply(Groups.isPending, uid, groupName),
					isInvited: async.apply(Groups.isInvited, uid, groupName),
				}, next);
			},
			function (checks, next) {
				if (!checks.exists) {
					return next(new Error('[[error:no-group]]'));
				} else if (checks.isMember) {
					return callback();
				} else if (type === 'invite' && checks.isInvited) {
					return callback();
				} else if (type === 'request' && checks.isPending) {
					return next(new Error('[[error:group-already-requested]]'));
				}

				db.setAdd(set, uid, next);
			},
			function (next) {
				plugins.fireHook(hookName, {
					groupName: groupName,
					uid: uid,
				});
				next();
			},
		], callback);
	}

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
				clearCache(uid, groupNames);
				Groups.getGroupsFields(groupNames, ['name', 'hidden', 'memberCount'], next);
			},
			function (groupData, next) {
				if (!groupData) {
					return callback();
				}
				var tasks = [];

				var emptyPrivilegeGroups = groupData.filter(function (groupData) {
					return groupData && Groups.isPrivilegeGroup(groupData.name) && parseInt(groupData.memberCount, 10) === 0;
				});
				if (emptyPrivilegeGroups.length) {
					tasks.push(async.apply(Groups.destroy, emptyPrivilegeGroups));
				}

				var visibleGroups = groupData.filter(function (groupData) {
					return groupData && parseInt(groupData.hidden, 10) !== 1;
				});
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
					groupName: groupNames[0],
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

	Groups.getMembers = function (groupName, start, stop, callback) {
		db.getSortedSetRevRange('group:' + groupName + ':members', start, stop, callback);
	};

	Groups.getMemberUsers = function (groupNames, start, stop, callback) {
		async.map(groupNames, function (groupName, next) {
			async.waterfall([
				function (next) {
					Groups.getMembers(groupName, start, stop, next);
				},
				function (uids, next) {
					user.getUsersFields(uids, ['uid', 'username', 'picture', 'userslug'], next);
				},
			], next);
		}, callback);
	};

	Groups.getMembersOfGroups = function (groupNames, callback) {
		db.getSortedSetsMembers(groupNames.map(function (name) {
			return 'group:' + name + ':members';
		}), callback);
	};

	Groups.resetCache = function () {
		pubsub.publish('group:cache:reset');
		cache.reset();
	};

	pubsub.on('group:cache:reset', function () {
		cache.reset();
	});

	function clearCache(uid, groupNames) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}
		pubsub.publish('group:cache:del', { uid: uid, groupNames: groupNames });
		groupNames.forEach(function (groupName) {
			cache.del(uid + ':' + groupName);
		});
	}

	pubsub.on('group:cache:del', function (data) {
		if (data && data.groupNames) {
			data.groupNames.forEach(function (groupName) {
				cache.del(data.uid + ':' + groupName);
			});
		}
	});

	Groups.isMember = function (uid, groupName, callback) {
		if (!uid || parseInt(uid, 10) <= 0 || !groupName) {
			return setImmediate(callback, null, false);
		}

		var cacheKey = uid + ':' + groupName;
		var isMember = cache.get(cacheKey);
		if (isMember !== undefined) {
			return setImmediate(callback, null, isMember);
		}

		async.waterfall([
			function (next) {
				db.isSortedSetMember('group:' + groupName + ':members', uid, next);
			},
			function (isMember, next) {
				cache.set(cacheKey, isMember);
				next(null, isMember);
			},
		], callback);
	};

	Groups.isMembers = function (uids, groupName, callback) {
		var cachedData = {};
		function getFromCache() {
			setImmediate(callback, null, uids.map(function (uid) {
				return cachedData[uid + ':' + groupName];
			}));
		}

		if (!groupName || !uids.length) {
			return callback(null, uids.map(function () { return false; }));
		}

		var nonCachedUids = uids.filter(function (uid) {
			var isMember = cache.get(uid + ':' + groupName);
			if (isMember !== undefined) {
				cachedData[uid + ':' + groupName] = isMember;
			}
			return isMember === undefined;
		});

		if (!nonCachedUids.length) {
			return getFromCache(callback);
		}

		async.waterfall([
			function (next) {
				db.isSortedSetMembers('group:' + groupName + ':members', nonCachedUids, next);
			},
			function (isMembers, next) {
				nonCachedUids.forEach(function (uid, index) {
					cachedData[uid + ':' + groupName] = isMembers[index];
					cache.set(uid + ':' + groupName, isMembers[index]);
				});

				getFromCache(next);
			},
		], callback);
	};

	Groups.isMemberOfGroups = function (uid, groups, callback) {
		var cachedData = {};
		function getFromCache(next) {
			setImmediate(next, null, groups.map(function (groupName) {
				return cachedData[uid + ':' + groupName];
			}));
		}

		if (!uid || parseInt(uid, 10) <= 0 || !groups.length) {
			return callback(null, groups.map(function () { return false; }));
		}

		var nonCachedGroups = groups.filter(function (groupName) {
			var isMember = cache.get(uid + ':' + groupName);
			if (isMember !== undefined) {
				cachedData[uid + ':' + groupName] = isMember;
			}
			return isMember === undefined;
		});

		if (!nonCachedGroups.length) {
			return getFromCache(callback);
		}

		var nonCachedGroupsMemberSets = nonCachedGroups.map(function (groupName) {
			return 'group:' + groupName + ':members';
		});

		async.waterfall([
			function (next) {
				db.isMemberOfSortedSets(nonCachedGroupsMemberSets, uid, next);
			},
			function (isMembers, next) {
				nonCachedGroups.forEach(function (groupName, index) {
					cachedData[uid + ':' + groupName] = isMembers[index];
					cache.set(uid + ':' + groupName, isMembers[index]);
				});

				getFromCache(next);
			},
		], callback);
	};

	Groups.getMemberCount = function (groupName, callback) {
		async.waterfall([
			function (next) {
				db.getObjectField('group:' + groupName, 'memberCount', next);
			},
			function (count, next) {
				next(null, parseInt(count, 10));
			},
		], callback);
	};

	Groups.isMemberOfGroupList = function (uid, groupListKey, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRange('group:' + groupListKey + ':members', 0, -1, next);
			},
			function (groupNames, next) {
				groupNames = Groups.removeEphemeralGroups(groupNames);
				if (groupNames.length === 0) {
					return callback(null, false);
				}

				Groups.isMemberOfGroups(uid, groupNames, next);
			},
			function (isMembers, next) {
				next(null, isMembers.indexOf(true) !== -1);
			},
		], callback);
	};

	Groups.isMemberOfGroupsList = function (uid, groupListKeys, callback) {
		var sets = groupListKeys.map(function (groupName) {
			return 'group:' + groupName + ':members';
		});

		var uniqueGroups;
		var members;
		async.waterfall([
			function (next) {
				db.getSortedSetsMembers(sets, next);
			},
			function (_members, next) {
				members = _members;
				uniqueGroups = _.uniq(_.flatten(members));
				uniqueGroups = Groups.removeEphemeralGroups(uniqueGroups);

				Groups.isMemberOfGroups(uid, uniqueGroups, next);
			},
			function (isMembers, next) {
				var map = {};

				uniqueGroups.forEach(function (groupName, index) {
					map[groupName] = isMembers[index];
				});

				var result = members.map(function (groupNames) {
					for (var i = 0; i < groupNames.length; i += 1) {
						if (map[groupNames[i]]) {
							return true;
						}
					}
					return false;
				});

				next(null, result);
			},
		], callback);
	};

	Groups.isMembersOfGroupList = function (uids, groupListKey, callback) {
		var groupNames;
		var results = [];
		uids.forEach(function () {
			results.push(false);
		});

		async.waterfall([
			function (next) {
				db.getSortedSetRange('group:' + groupListKey + ':members', 0, -1, next);
			},
			function (_groupNames, next) {
				groupNames = Groups.removeEphemeralGroups(_groupNames);

				if (groupNames.length === 0) {
					return callback(null, results);
				}

				async.map(groupNames, function (groupName, next) {
					Groups.isMembers(uids, groupName, next);
				}, next);
			},
			function (isGroupMembers, next) {
				isGroupMembers.forEach(function (isMembers) {
					results.forEach(function (isMember, index) {
						if (!isMember && isMembers[index]) {
							results[index] = true;
						}
					});
				});
				next(null, results);
			},
		], callback);
	};

	Groups.isInvited = function (uid, groupName, callback) {
		if (!uid) {
			return setImmediate(callback, null, false);
		}
		db.isSetMember('group:' + groupName + ':invited', uid, callback);
	};

	Groups.isPending = function (uid, groupName, callback) {
		if (!uid) {
			return setImmediate(callback, null, false);
		}
		db.isSetMember('group:' + groupName + ':pending', uid, callback);
	};

	Groups.getPending = function (groupName, callback) {
		if (!groupName) {
			return setImmediate(callback, null, []);
		}
		db.getSetMembers('group:' + groupName + ':pending', callback);
	};

	Groups.kick = function (uid, groupName, isOwner, callback) {
		if (isOwner) {
			// If the owners set only contains one member, error out!
			async.waterfall([
				function (next) {
					db.setCount('group:' + groupName + ':owners', next);
				},
				function (numOwners, next) {
					if (numOwners <= 1) {
						return next(new Error('[[error:group-needs-owner]]'));
					}
					Groups.leave(groupName, uid, next);
				},
			], callback);
		} else {
			Groups.leave(groupName, uid, callback);
		}
	};
};
