'use strict';

var async = require('async');
var _ = require('lodash');

var user = require('../user');
var utils = require('../utils');
var plugins = require('../plugins');
var notifications = require('../notifications');
var db = require('../database');

module.exports = function (Groups) {
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
							type: 'group-request-membership',
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
		if (!(parseInt(uid, 10) > 0)) {
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
		db.getSortedSetsMembers(groupNames.map(name => 'group:' + name + ':members'), callback);
	};

	Groups.isMember = function (uid, groupName, callback) {
		if (!uid || parseInt(uid, 10) <= 0 || !groupName) {
			return setImmediate(callback, null, false);
		}

		var cacheKey = uid + ':' + groupName;
		var isMember = Groups.cache.get(cacheKey);
		if (isMember !== undefined) {
			Groups.cache.hits += 1;
			return setImmediate(callback, null, isMember);
		}
		Groups.cache.misses += 1;
		async.waterfall([
			function (next) {
				db.isSortedSetMember('group:' + groupName + ':members', uid, next);
			},
			function (isMember, next) {
				Groups.cache.set(cacheKey, isMember);
				next(null, isMember);
			},
		], callback);
	};

	Groups.isMembers = function (uids, groupName, callback) {
		var cachedData = {};
		function getFromCache() {
			setImmediate(callback, null, uids.map(uid => cachedData[uid + ':' + groupName]));
		}
		if (!groupName || !uids.length) {
			return setImmediate(callback, null, uids.map(() => false));
		}

		if (groupName === 'guests') {
			return setImmediate(callback, null, uids.map(uid => parseInt(uid, 10) === 0));
		}

		var nonCachedUids = uids.filter(uid => filterNonCached(cachedData, uid, groupName));

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
					Groups.cache.set(uid + ':' + groupName, isMembers[index]);
				});

				getFromCache(next);
			},
		], callback);
	};

	Groups.isMemberOfGroups = function (uid, groups, callback) {
		var cachedData = {};
		function getFromCache(next) {
			setImmediate(next, null, groups.map(groupName => cachedData[uid + ':' + groupName]));
		}

		if (!uid || parseInt(uid, 10) <= 0 || !groups.length) {
			return callback(null, groups.map(groupName => groupName === 'guests'));
		}

		var nonCachedGroups = groups.filter(groupName => filterNonCached(cachedData, uid, groupName));

		if (!nonCachedGroups.length) {
			return getFromCache(callback);
		}

		async.waterfall([
			function (next) {
				const nonCachedGroupsMemberSets = nonCachedGroups.map(groupName => 'group:' + groupName + ':members');
				db.isMemberOfSortedSets(nonCachedGroupsMemberSets, uid, next);
			},
			function (isMembers, next) {
				nonCachedGroups.forEach(function (groupName, index) {
					cachedData[uid + ':' + groupName] = isMembers[index];
					Groups.cache.set(uid + ':' + groupName, isMembers[index]);
				});

				getFromCache(next);
			},
		], callback);
	};

	function filterNonCached(cachedData, uid, groupName) {
		var isMember = Groups.cache.get(uid + ':' + groupName);
		var isInCache = isMember !== undefined;
		if (isInCache) {
			Groups.cache.hits += 1;
			cachedData[uid + ':' + groupName] = isMember;
		} else {
			Groups.cache.misses += 1;
		}
		return !isInCache;
	}

	Groups.isMemberOfAny = function (uid, groups, callback) {
		if (!groups.length) {
			return setImmediate(callback, null, false);
		}
		async.waterfall([
			function (next) {
				Groups.isMemberOfGroups(uid, groups, next);
			},
			function (isMembers, next) {
				next(null, isMembers.some(isMember => !!isMember));
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
				if (!groupNames.length) {
					return callback(null, false);
				}

				Groups.isMemberOfGroups(uid, groupNames, next);
			},
			function (isMembers, next) {
				next(null, isMembers.includes(true));
			},
		], callback);
	};

	Groups.isMemberOfGroupsList = function (uid, groupListKeys, callback) {
		var uniqueGroups;
		var members;
		async.waterfall([
			function (next) {
				const sets = groupListKeys.map(groupName => 'group:' + groupName + ':members');
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
		var results = uids.map(() => false);

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
		if (!(parseInt(uid, 10) > 0)) {
			return setImmediate(callback, null, false);
		}
		db.isSetMember('group:' + groupName + ':invited', uid, callback);
	};

	Groups.isPending = function (uid, groupName, callback) {
		if (!(parseInt(uid, 10) > 0)) {
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
