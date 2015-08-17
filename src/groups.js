'use strict';

var async = require('async'),
	winston = require('winston'),
	nconf = require('nconf'),
	validator = require('validator'),

	user = require('./user'),
	db = require('./database'),
	plugins = require('./plugins'),
	posts = require('./posts'),
	privileges = require('./privileges'),
	utils = require('../public/src/utils');

(function(Groups) {

	require('./groups/create')(Groups);
	require('./groups/delete')(Groups);
	require('./groups/update')(Groups);
	require('./groups/membership')(Groups);
	require('./groups/ownership')(Groups);
	require('./groups/search')(Groups);

	var ephemeralGroups = ['guests'],

		internals = {
			getEphemeralGroup: function(groupName) {
				return {
					name: groupName,
					slug: utils.slugify(groupName),
					description: '',
					deleted: '0',
					hidden: '0',
					system: '1'
				};
			},
			removeEphemeralGroups: function(groups) {
				var x = groups.length;
				while(x--) {
					if (ephemeralGroups.indexOf(groups[x]) !== -1) {
						groups.splice(x, 1);
					}
				}

				return groups;
			}
		};

	Groups.internals = internals;

	var isPrivilegeGroupRegex = /^cid:\d+:privileges:[\w:]+$/;
	Groups.isPrivilegeGroup = function(groupName) {
		return isPrivilegeGroupRegex.test(groupName);
	};

	Groups.getEphemeralGroups = function() {
		return ephemeralGroups;
	};

	Groups.getGroupsFromSet = function(set, uid, start, stop, callback) {
		var method;
		var args;
		if (set === 'groups:visible:name') {
			method = db.getSortedSetRangeByLex;
			args = [set, '-', '+', start, stop - start + 1, done];
		} else {
			method = db.getSortedSetRevRange;
			args = [set, start, stop, done];
		}
		method.apply(null, args);

		function done(err, groupNames) {
			if (err) {
				return callback(err);
			}

			if (set === 'groups:visible:name') {
				groupNames = groupNames.map(function(name) {
					return name.split(':')[1];
				});
			}

			async.parallel({
				groups: function(next) {
					Groups.getGroupsData(groupNames, next);
				},
				members: function(next) {
					Groups.getMemberUsers(groupNames, 0, 3, next);
				}
			}, function (err, data) {
				if (err) {
					return callback(err);
				}
				data.groups.forEach(function(group, index) {
					if (!group) {
						return;
					}
					Groups.escapeGroupData(group);
					group.members = data.members[index] || [];
					group.truncated = group.memberCount > data.members.length;
				});

				callback(null, data.groups);
			});
		}
	};

	Groups.getGroups = function(set, start, stop, callback) {
		db.getSortedSetRevRange(set, start, stop, callback);
	};

	Groups.get = function(groupName, options, callback) {
		if (!groupName) {
			return callback(new Error('[[error:invalid-group]]'));
		}

		options.escape = options.hasOwnProperty('escape') ? options.escape : true;
		var stop = -1;

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
				async.waterfall([
					function(next) {
						db.getSetMembers('group:' + groupName + ':pending', next);
					},
					function(uids, next) {
						user.getUsersData(uids, next);
					}
				], next);
			},
			invited: function (next) {
				async.waterfall([
					function(next) {
						db.getSetMembers('group:' + groupName + ':invited', next);
					},
					function(uids, next) {
						user.getUsersData(uids, next);
					}
				], next);
			},
			isMember: async.apply(Groups.isMember, options.uid, groupName),
			isPending: async.apply(Groups.isPending, options.uid, groupName),
			isInvited: async.apply(Groups.isInvited, options.uid, groupName),
			isOwner: async.apply(Groups.ownership.isOwner, options.uid, groupName)
		}, function (err, results) {
			if (err) {
				return callback(err);
			} else if (!results.base) {
				return callback(new Error('[[error:no-group]]'));
			}

			// Default image
			if (!results.base['cover:url']) {
				results.base['cover:url'] = nconf.get('relative_path') + '/images/cover-default.png';
				results.base['cover:position'] = '50% 50%';
			}

			plugins.fireHook('filter:parse.raw', results.base.description, function(err, descriptionParsed) {
				if (err) {
					return callback(err);
				}

				if (options.escape) {
					Groups.escapeGroupData(results.base);
				}

				results.base.descriptionParsed = descriptionParsed;
				results.base.userTitleEnabled = results.base.userTitleEnabled ? !!parseInt(results.base.userTitleEnabled, 10) : true;
				results.base.createtimeISO = utils.toISOString(results.base.createtime);
				results.base.members = results.members;
				results.base.membersNextStart = stop + 1;
				results.base.pending = results.pending.filter(Boolean);
				results.base.invited = results.invited.filter(Boolean);
				results.base.deleted = !!parseInt(results.base.deleted, 10);
				results.base.hidden = !!parseInt(results.base.hidden, 10);
				results.base.system = !!parseInt(results.base.system, 10);
				results.base.private = results.base.private ? !!parseInt(results.base.private, 10) : true;
				results.base.isMember = results.isMember;
				results.base.isPending = results.isPending;
				results.base.isInvited = results.isInvited;
				results.base.isOwner = results.isOwner;

				plugins.fireHook('filter:group.get', {group: results.base}, function(err, data) {
					callback(err, data ? data.group : null);
				});
			});
		});
	};

	Groups.getOwnersAndMembers = function(groupName, uid, start, stop, callback) {
		async.parallel({
			owners: function (next) {
				async.waterfall([
					function(next) {
						db.getSetMembers('group:' + groupName + ':owners', next);
					},
					function(uids, next) {
						user.getUsers(uids, uid, next);
					}
				], next);
			},
			members: function (next) {
				user.getUsersFromSet('group:' + groupName + ':members', uid, start, stop, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var ownerUids = [];
			results.owners.forEach(function(user) {
				if (user) {
					user.isOwner = true;
					ownerUids.push(user.uid.toString());
				}
			});

			results.members = results.members.filter(function(user, index, array) {
				return user && user.uid && ownerUids.indexOf(user.uid.toString()) === -1;
			});
			results.members = results.owners.concat(results.members);

			callback(null, results.members);
		});
	};

	Groups.escapeGroupData = function(group) {
		if (group) {
			group.nameEncoded = encodeURIComponent(group.name);
			group.displayName = validator.escape(group.name);
			group.description = validator.escape(group.description);
			group.userTitle = validator.escape(group.userTitle) || group.displayName;
		}
	};

	Groups.getByGroupslug = function(slug, options, callback) {
		db.getObjectField('groupslug:groupname', slug, function(err, groupName) {
			if (err) {
				return callback(err);
			} else if (!groupName) {
				return callback(new Error('[[error:no-group]]'));
			}

			Groups.get.call(Groups, groupName, options, callback);
		});
	};

	Groups.getGroupNameByGroupSlug = function(slug, callback) {
		db.getObjectField('groupslug:groupname', slug, callback);
	};

	Groups.getGroupFields = function(groupName, fields, callback) {
		Groups.getMultipleGroupFields([groupName], fields, function(err, groups) {
			callback(err, groups ? groups[0] : null);
		});
	};

	Groups.getMultipleGroupFields = function(groups, fields, callback) {
		db.getObjectsFields(groups.map(function(group) {
			return 'group:' + group;
		}), fields, callback);
	};

	Groups.setGroupField = function(groupName, field, value, callback) {
		db.setObjectField('group:' + groupName, field, value, function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:group.set', {field: field, value: value, type: 'set'});
			callback();
		});
	};

	Groups.isPrivate = function(groupName, callback) {
		db.getObjectField('group:' + groupName, 'private', function(err, isPrivate) {
			isPrivate = isPrivate || isPrivate === null;

			if (typeof isPrivate === 'string') {
				isPrivate = (isPrivate === '0' ? false : true);
			}

			callback(err, isPrivate);	// Private, if not set at all
		});
	};

	Groups.isHidden = function(groupName, callback) {
		Groups.getGroupFields(groupName, ['hidden'], function(err, values) {
			if (err) {
				winston.warn('[groups.isHidden] Could not determine group hidden state (group: ' + groupName + ')');
				return callback(null, true);	// Default true
			}

			callback(null, parseInt(values.hidden, 10));
		});
	};

	Groups.exists = function(name, callback) {
		if (Array.isArray(name)) {
			var slugs = name.map(function(groupName) {
					return utils.slugify(groupName);
				});
			async.parallel([
				function(next) {
					callback(null, slugs.map(function(slug) {
						return ephemeralGroups.indexOf(slug) !== -1;
					}));
				},
				async.apply(db.isSortedSetMembers, 'groups:createtime', name)
			], function(err, results) {
				if (err) {
					return callback(err);
				}

				callback(null, results.map(function(result) {
					return result[0] || result[1];
				}));
			});
		} else {
			var slug = utils.slugify(name);
			async.parallel([
				function(next) {
					next(null, ephemeralGroups.indexOf(slug) !== -1);
				},
				async.apply(db.isSortedSetMember, 'groups:createtime', name)
			], function(err, results) {
				callback(err, !err ? (results[0] || results[1]) : null);
			});
		}
	};

	Groups.existsBySlug = function(slug, callback) {
		if (Array.isArray(slug)) {
			db.isObjectFields('groupslug:groupname', slug, callback);
		} else {
			db.isObjectField('groupslug:groupname', slug, callback);
		}
	};

	Groups.getLatestMemberPosts = function(groupName, max, uid, callback) {
		async.waterfall([
			async.apply(Groups.getMembers, groupName, 0, -1),
			function(uids, next) {
				if (!Array.isArray(uids) || !uids.length) {
					return callback(null, []);
				}
				var keys = uids.map(function(uid) {
					return 'uid:' + uid + ':posts';
				});
				db.getSortedSetRevUnion(keys, 0, max - 1, next);
			},
			function(pids, next) {
				privileges.posts.filter('read', pids, uid, next);
			},
			function(pids, next) {
				posts.getPostSummaryByPids(pids, uid, {stripTags: false}, next);
			}
		], callback);
	};

	Groups.getGroupsData = function(groupNames, callback) {
		if (!Array.isArray(groupNames) || !groupNames.length) {
			return callback(null, []);
		}
		var keys = groupNames.map(function(groupName) {
				return 'group:' + groupName;
			}),
			ephemeralIdx = groupNames.reduce(function(memo, cur, idx) {
				if (ephemeralGroups.indexOf(cur) !== -1) {
					memo.push(idx);
				}
				return memo;
			}, []);

		db.getObjects(keys, function(err, groupData) {
			if (err) {
				return callback(err);
			}

			if (ephemeralIdx.length) {
				ephemeralIdx.forEach(function(idx) {
					groupData[idx] = internals.getEphemeralGroup(groupNames[idx]);
				});
			}

			groupData.forEach(function(group) {
				if (group) {
					group.userTitle = validator.escape(group.userTitle) || validator.escape(group.name);
					group.userTitleEnabled = group.userTitleEnabled ? parseInt(group.userTitleEnabled, 10) === 1 : true;
					group.labelColor = group.labelColor || '#000000';
					group.createtimeISO = utils.toISOString(group.createtime);
					group.hidden = parseInt(group.hidden, 10) === 1;
					group.system = parseInt(group.system, 10) === 1;
					group.private = parseInt(group.private, 10) === 1;
					if (!group['cover:url']) {
						group['cover:url'] = nconf.get('relative_path') + '/images/cover-default.png';
						group['cover:position'] = '50% 50%';
					}
				}
			});

			plugins.fireHook('filter:groups.get', {groups: groupData}, function(err, data) {
				callback(err, data ? data.groups : null);
			});
		});
	};

	Groups.getUserGroups = function(uids, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange('groups:visible:createtime', 0, -1, next);
			},
			function(groupNames, next) {
				var groupSets = groupNames.map(function(name) {
		 			return 'group:' + name + ':members';
		 		});

		 		async.map(uids, function(uid, next) {
					db.isMemberOfSortedSets(groupSets, uid, function(err, isMembers) {
						if (err) {
							return next(err);
						}

						var memberOf = [];
						isMembers.forEach(function(isMember, index) {
							if (isMember) {
								memberOf.push(groupNames[index]);
							}
						});

						Groups.getGroupsData(memberOf, next);
					});
				}, next);
			}
		], callback);
	};

}(module.exports));
