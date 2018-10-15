'use strict';

var async = require('async');
var validator = require('validator');

var user = require('./user');
var db = require('./database');
var plugins = require('./plugins');
var utils = require('./utils');

var Groups = module.exports;

require('./groups/data')(Groups);
require('./groups/create')(Groups);
require('./groups/delete')(Groups);
require('./groups/update')(Groups);
require('./groups/membership')(Groups);
require('./groups/ownership')(Groups);
require('./groups/search')(Groups);
require('./groups/cover')(Groups);
require('./groups/posts')(Groups);
require('./groups/user')(Groups);


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
		if (Groups.ephemeralGroups.indexOf(groups[x]) !== -1) {
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
					group.truncated = group.memberCount > data.members.length;
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
					db.getObject('group:' + groupName, next);
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
			Groups.escapeGroupData(groupData);

			groupData.descriptionParsed = descriptionParsed;
			groupData.userTitleEnabled = groupData.userTitleEnabled ? parseInt(groupData.userTitleEnabled, 10) === 1 : true;
			groupData.createtimeISO = utils.toISOString(groupData.createtime);
			groupData.members = results.members;
			groupData.membersNextStart = stop + 1;
			groupData.pending = results.pending.filter(Boolean);
			groupData.invited = results.invited.filter(Boolean);
			groupData.deleted = !!parseInt(groupData.deleted, 10);
			groupData.hidden = !!parseInt(groupData.hidden, 10);
			groupData.system = !!parseInt(groupData.system, 10);
			groupData.memberCount = parseInt(groupData.memberCount, 10);
			groupData.private = (groupData.private === null || groupData.private === undefined) ? true : !!parseInt(groupData.private, 10);
			groupData.disableJoinRequests = parseInt(groupData.disableJoinRequests, 10) === 1;
			groupData.isMember = results.isMember;
			groupData.isPending = results.isPending;
			groupData.isInvited = results.isInvited;
			groupData.isOwner = results.isOwner;
			groupData['cover:url'] = groupData['cover:url'] || require('./coverPhoto').getDefaultGroupCover(groupName);
			groupData['cover:position'] = validator.escape(String(groupData['cover:position'] || '50% 50%'));
			groupData.labelColor = validator.escape(String(groupData.labelColor || '#000000'));
			groupData.icon = validator.escape(String(groupData.icon || ''));

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
				return user && user.uid && ownerUids.indexOf(user.uid.toString()) === -1;
			});
			results.members = results.owners.concat(results.members);

			next(null, results.members);
		},
	], callback);
};

Groups.escapeGroupData = function (group) {
	if (group) {
		group.nameEncoded = encodeURIComponent(group.name);
		group.displayName = validator.escape(String(group.name));
		group.description = validator.escape(String(group.description || ''));
		group.userTitle = validator.escape(String(group.userTitle || '')) || group.displayName;
	}
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
		var slugs = name.map(function (groupName) {
			return utils.slugify(groupName);
		});
		async.parallel([
			function (next) {
				next(null, slugs.map(function (slug) {
					return Groups.ephemeralGroups.indexOf(slug) !== -1;
				}));
			},
			async.apply(db.isSortedSetMembers, 'groups:createtime', name),
		], function (err, results) {
			if (err) {
				return callback(err);
			}
			callback(null, name.map(function (n, index) {
				return results[0][index] || results[1][index];
			}));
		});
	} else {
		var slug = utils.slugify(name);
		async.parallel([
			function (next) {
				next(null, Groups.ephemeralGroups.indexOf(slug) !== -1);
			},
			async.apply(db.isSortedSetMember, 'groups:createtime', name),
		], function (err, results) {
			callback(err, !err ? (results[0] || results[1]) : null);
		});
	}
};

Groups.existsBySlug = function (slug, callback) {
	if (Array.isArray(slug)) {
		db.isObjectFields('groupslug:groupname', slug, callback);
	} else {
		db.isObjectField('groupslug:groupname', slug, callback);
	}
};

Groups.async = require('./promisify')(Groups);
