'use strict';

var async = require('async');

var user = require('../user');
var db = require('../database');
var plugins = require('../plugins');
var utils = require('../utils');

var Groups = module.exports;

require('./data')(Groups);
require('./create')(Groups);
require('./delete')(Groups);
require('./update')(Groups);
require('./membership')(Groups);
require('./ownership')(Groups);
require('./search')(Groups);
require('./cover')(Groups);
require('./posts')(Groups);
require('./user')(Groups);
require('./join')(Groups);
require('./leave')(Groups);
require('./cache')(Groups);


Groups.ephemeralGroups = ['guests', 'spiders'];

Groups.getEphemeralGroup = function (groupName) {
	return {
		name: groupName,
		slug: utils.slugify(groupName),
		description: '',
		deleted: '0',
		hidden: '0',
		system: '1',
	};
};

Groups.removeEphemeralGroups = function (groups) {
	for (var x = groups.length; x >= 0; x -= 1) {
		if (Groups.ephemeralGroups.includes(groups[x])) {
			groups.splice(x, 1);
		}
	}

	return groups;
};

var isPrivilegeGroupRegex = /^cid:\d+:privileges:[\w:]+$/;
Groups.isPrivilegeGroup = function (groupName) {
	return isPrivilegeGroupRegex.test(groupName);
};

Groups.getGroupsFromSet = function (set, uid, start, stop, callback) {
	async.waterfall([
		function (next) {
			if (set === 'groups:visible:name') {
				db.getSortedSetRangeByLex(set, '-', '+', start, stop - start + 1, next);
			} else {
				db.getSortedSetRevRange(set, start, stop, next);
			}
		},
		function (groupNames, next) {
			if (set === 'groups:visible:name') {
				groupNames = groupNames.map(function (name) {
					return name.split(':')[1];
				});
			}

			Groups.getGroupsAndMembers(groupNames, next);
		},
	], callback);
};

Groups.getNonPrivilegeGroups = function (set, start, stop, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRevRange(set, start, stop, next);
		},
		function (groupNames, next) {
			groupNames = groupNames.concat(Groups.ephemeralGroups).filter(groupName => !Groups.isPrivilegeGroup(groupName));
			Groups.getGroupsData(groupNames, next);
		},
	], callback);
};

Groups.getGroups = function (set, start, stop, callback) {
	db.getSortedSetRevRange(set, start, stop, callback);
};

Groups.getGroupsAndMembers = function (groupNames, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				groups: function (next) {
					Groups.getGroupsData(groupNames, next);
				},
				members: function (next) {
					Groups.getMemberUsers(groupNames, 0, 3, next);
				},
			}, next);
		},
		function (data, next) {
			data.groups.forEach(function (group, index) {
				if (group) {
					group.members = data.members[index] || [];
					group.truncated = group.memberCount > group.members.length;
				}
			});
			next(null, data.groups);
		},
	], callback);
};

Groups.get = function (groupName, options, callback) {
	if (!groupName) {
		return callback(new Error('[[error:invalid-group]]'));
	}

	var stop = -1;

	var results;
	async.waterfall([
		function (next) {
			async.parallel({
				base: function (next) {
					Groups.getGroupData(groupName, next);
				},
				members: function (next) {
					if (options.truncateUserList) {
						stop = (parseInt(options.userListCount, 10) || 4) - 1;
					}

					Groups.getOwnersAndMembers(groupName, options.uid, 0, stop, next);
				},
				pending: function (next) {
					Groups.getUsersFromSet('group:' + groupName + ':pending', ['username', 'userslug', 'picture'], next);
				},
				invited: function (next) {
					Groups.getUsersFromSet('group:' + groupName + ':invited', ['username', 'userslug', 'picture'], next);
				},
				isMember: async.apply(Groups.isMember, options.uid, groupName),
				isPending: async.apply(Groups.isPending, options.uid, groupName),
				isInvited: async.apply(Groups.isInvited, options.uid, groupName),
				isOwner: async.apply(Groups.ownership.isOwner, options.uid, groupName),
			}, next);
		},
		function (_results, next) {
			results = _results;
			if (!results.base) {
				return callback(null, null);
			}
			plugins.fireHook('filter:parse.raw', results.base.description, next);
		},
		function (descriptionParsed, next) {
			var groupData = results.base;

			groupData.descriptionParsed = descriptionParsed;
			groupData.members = results.members;
			groupData.membersNextStart = stop + 1;
			groupData.pending = results.pending.filter(Boolean);
			groupData.invited = results.invited.filter(Boolean);

			groupData.isMember = results.isMember;
			groupData.isPending = results.isPending;
			groupData.isInvited = results.isInvited;
			groupData.isOwner = results.isOwner;

			plugins.fireHook('filter:group.get', { group: groupData }, next);
		},
		function (results, next) {
			next(null, results.group);
		},
	], callback);
};

Groups.getOwners = function (groupName, callback) {
	db.getSetMembers('group:' + groupName + ':owners', callback);
};

Groups.getOwnersAndMembers = function (groupName, uid, start, stop, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				owners: function (next) {
					async.waterfall([
						function (next) {
							db.getSetMembers('group:' + groupName + ':owners', next);
						},
						function (uids, next) {
							user.getUsers(uids, uid, next);
						},
					], next);
				},
				members: function (next) {
					user.getUsersFromSet('group:' + groupName + ':members', uid, start, stop, next);
				},
			}, next);
		},
		function (results, next) {
			var ownerUids = [];
			results.owners.forEach(function (user) {
				if (user) {
					user.isOwner = true;
					ownerUids.push(user.uid.toString());
				}
			});

			results.members = results.members.filter(function (user) {
				return user && user.uid && !ownerUids.includes(user.uid.toString());
			});
			results.members = results.owners.concat(results.members);

			next(null, results.members);
		},
	], callback);
};

Groups.getByGroupslug = function (slug, options, callback) {
	async.waterfall([
		function (next) {
			db.getObjectField('groupslug:groupname', slug, next);
		},
		function (groupName, next) {
			if (!groupName) {
				return next(new Error('[[error:no-group]]'));
			}
			Groups.get(groupName, options, next);
		},
	], callback);
};

Groups.getGroupNameByGroupSlug = function (slug, callback) {
	db.getObjectField('groupslug:groupname', slug, callback);
};

Groups.isPrivate = function (groupName, callback) {
	isFieldOn(groupName, 'private', callback);
};

Groups.isHidden = function (groupName, callback) {
	isFieldOn(groupName, 'hidden', callback);
};

function isFieldOn(groupName, field, callback) {
	async.waterfall([
		function (next) {
			db.getObjectField('group:' + groupName, field, next);
		},
		function (value, next) {
			next(null, parseInt(value, 10) === 1);
		},
	], callback);
}

Groups.exists = function (name, callback) {
	if (Array.isArray(name)) {
		var slugs = name.map(groupName => utils.slugify(groupName));
		async.waterfall([
			async.apply(db.isSortedSetMembers, 'groups:createtime', name),
			function (isMembersOfRealGroups, next) {
				const isMembersOfEphemeralGroups = slugs.map(slug => Groups.ephemeralGroups.includes(slug));
				const exists = name.map((n, index) => isMembersOfRealGroups[index] || isMembersOfEphemeralGroups[index]);
				next(null, exists);
			},
		], callback);
	} else {
		var slug = utils.slugify(name);
		async.waterfall([
			async.apply(db.isSortedSetMember, 'groups:createtime', name),
			function (isMemberOfRealGroups, next) {
				const isMemberOfEphemeralGroups = Groups.ephemeralGroups.includes(slug);
				next(null, isMemberOfRealGroups || isMemberOfEphemeralGroups);
			},
		], callback);
	}
};

Groups.existsBySlug = function (slug, callback) {
	if (Array.isArray(slug)) {
		db.isObjectFields('groupslug:groupname', slug, callback);
	} else {
		db.isObjectField('groupslug:groupname', slug, callback);
	}
};

Groups.async = require('../promisify')(Groups);
