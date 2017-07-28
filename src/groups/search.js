'use strict';

var async = require('async');

var user = require('../user');
var db = require('./../database');


module.exports = function (Groups) {
	Groups.search = function (query, options, callback) {
		if (!query) {
			return callback(null, []);
		}
		query = query.toLowerCase();
		async.waterfall([
			async.apply(db.getObjectValues, 'groupslug:groupname'),
			function (groupNames, next) {
				// Ephemeral groups and the registered-users groups are searchable
				groupNames = Groups.ephemeralGroups.concat(groupNames).concat('registered-users');
				groupNames = groupNames.filter(function (name) {
					return name.toLowerCase().indexOf(query) !== -1 && name !== 'administrators' && !Groups.isPrivilegeGroup(name);
				});
				groupNames = groupNames.slice(0, 100);
				Groups.getGroupsData(groupNames, next);
			},
			function (groupsData, next) {
				groupsData = groupsData.filter(Boolean);
				if (options.filterHidden) {
					groupsData = groupsData.filter(function (group) {
						return !group.hidden;
					});
				}

				Groups.sort(options.sort, groupsData, next);
			},
		], callback);
	};

	Groups.sort = function (strategy, groups, next) {
		switch (strategy) {
		case 'count':
			groups = groups.sort(function (a, b) {
				return a.slug > b.slug;
			}).sort(function (a, b) {
				return b.memberCount - a.memberCount;
			});
			break;

		case 'date':
			groups = groups.sort(function (a, b) {
				return b.createtime - a.createtime;
			});
			break;

		case 'alpha':	// intentional fall-through
		default:
			groups = groups.sort(function (a, b) {
				return a.slug > b.slug ? 1 : -1;
			});
		}

		next(null, groups);
	};

	Groups.searchMembers = function (data, callback) {
		if (!data.query) {
			Groups.getOwnersAndMembers(data.groupName, data.uid, 0, 19, function (err, users) {
				callback(err, { users: users });
			});
			return;
		}

		var results;
		async.waterfall([
			function (next) {
				data.paginate = false;
				user.search(data, next);
			},
			function (_results, next) {
				results = _results;
				var uids = results.users.map(function (user) {
					return user && user.uid;
				});

				Groups.isMembers(uids, data.groupName, next);
			},
			function (isMembers, next) {
				results.users = results.users.filter(function (user, index) {
					return isMembers[index];
				});
				var uids = results.users.map(function (user) {
					return user && user.uid;
				});
				Groups.ownership.isOwners(uids, data.groupName, next);
			},
			function (isOwners, next) {
				results.users.forEach(function (user, index) {
					if (user) {
						user.isOwner = isOwners[index];
					}
				});

				results.users.sort(function (a, b) {
					if (a.isOwner && !b.isOwner) {
						return -1;
					} else if (!a.isOwner && b.isOwner) {
						return 1;
					}
					return 0;
				});
				next(null, results);
			},
		], callback);
	};
};
