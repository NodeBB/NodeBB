'use strict';

var async = require('async'),
	winston = require('winston'),
	path = require('path'),
	nconf = require('nconf'),
	fs = require('fs'),
	validator = require('validator'),

	user = require('./user'),
	meta = require('./meta'),
	db = require('./database'),
	plugins = require('./plugins'),
	posts = require('./posts'),
	privileges = require('./privileges'),
	utils = require('../public/src/utils'),
	util = require('util');

(function(Groups) {

	require('./groups/create')(Groups);
	require('./groups/delete')(Groups);
	require('./groups/update')(Groups);
	require('./groups/membership')(Groups);
	require('./groups/ownership')(Groups);
	require('./groups/search')(Groups);

	var ephemeralGroups = ['guests'],

		internals = {
			filterGroups: function(groups, options) {
				// Remove system, hidden, or deleted groups from this list
				if (groups && !options.showAllGroups) {
					return groups.filter(function (group) {
						if (!group) {
							return false;
						}
						if (group.deleted || (group.hidden && !(group.system || group.isMember || options.isAdmin || group.isInvited)) || (!options.showSystemGroups && group.system)) {
							return false;
						} else if (options.removeEphemeralGroups && ephemeralGroups.indexOf(group.name) !== -1) {
							return false;
						} else {
							return true;
						}
					});
				} else {
					return groups;
				}
			},
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

	Groups.list = function(options, callback) {
		db.getSortedSetRevRange('groups:createtime', 0, -1, function (err, groupNames) {
			if (err) {
				return callback(err);
			}

			groupNames = groupNames.filter(function(groupName) {
				return groupName && groupName.indexOf(':privileges:') === -1 && groupName !== 'registered-users' && groupName !== 'guests';
			});

			async.parallel({
				groups: async.apply(async.map, groupNames, function (groupName, next) {
					Groups.get(groupName, options, next);
				}),
				isAdmin: function(next) {
					if (!options.uid || parseInt(options.uid, 10) === 0) { return next(null, false); }
					user.isAdministrator(parseInt(options.uid, 10), next);
				}
			}, function (err, data) {
				options.isAdmin = options.isAdmin || data.isAdmin;
				callback(err, internals.filterGroups(data.groups, options));
			});
		});
	};

	Groups.getGroups = function(start, stop, callback) {
		db.getSortedSetRevRange('groups:createtime', start, stop, callback);
	};

	Groups.get = function(groupName, options, callback) {
		var	truncated = false,
			numUsers;

		async.parallel({
			base: function (next) {
				if (ephemeralGroups.indexOf(groupName) === -1) {
					db.getObject('group:' + groupName, next);
				} else {
					next(null, internals.getEphemeralGroup(groupName));
				}
			},
			users: function (next) {
				db.getSortedSetRevRange('group:' + groupName + ':members', 0, -1, function (err, uids) {
					if (err) {
						return next(err);
					}

					uids = uids.filter(function(uid) {
						return uid && parseInt(uid, 10);
					});

					if (options.truncateUserList) {
						var userListCount = parseInt(options.userListCount, 10) || 4;
						if (uids.length > userListCount) {
							numUsers = uids.length;
							uids.length = userListCount;
							truncated = true;
						}
					}

					if (options.expand) {
						async.waterfall([
							async.apply(user.getUsers, uids, options.uid || 0),
							function(users, next) {
								// Filter out non-matches
								users = users.filter(Boolean);

								async.mapLimit(users, 10, function(userObj, next) {
									Groups.ownership.isOwner(userObj.uid, groupName, function(err, isOwner) {
										if (err) {
											winston.warn('[groups.get] Could not determine ownership in group `' + groupName + '` for uid `' + userObj.uid + '`: ' + err.message);
											return next(null, userObj);
										}

										userObj.isOwner = isOwner;
										next(null, userObj);
									});
								}, function(err, users) {
									if (err) {
										return next();
									}

									next(null, users.sort(function(a, b) {
										if (a.isOwner === b.isOwner) {
											return 0;
										} else {
											return a.isOwner && !b.isOwner ? -1 : 1;
										}
									}));
								});
							}
						], next);
					} else {
						next(err, uids);
					}
				});
			},
			pending: function (next) {
				db.getSetMembers('group:' + groupName + ':pending', function (err, uids) {
					if (err) {
						return next(err);
					}

					if (options.expand && uids.length) {
						async.map(uids, user.getUserData, next);
					} else {
						next(err, uids);
					}
				});
			},
			isMember: function(next) {
				// Retrieve group membership state, if uid is passed in
				if (!options.uid) {
					return next();
				}

				Groups.isMember(options.uid, groupName, function(err, isMember) {
					if (err) {
						winston.warn('[groups.get] Could not determine membership in group `' + groupName + '` for uid `' + options.uid + '`: ' + err.message);
						return next();
					}

					next(null, isMember);
				});
			},
			isPending: function(next) {
				// Retrieve group membership state, if uid is passed in
				if (!options.uid) {
					return next();
				}

				db.isSetMember('group:' + groupName + ':pending', options.uid, next);
			},
			isInvited: async.apply(Groups.isInvited, options.uid, groupName),
			isOwner: function(next) {
				// Retrieve group ownership state, if uid is passed in
				if (!options.uid) {
					return next();
				}

				Groups.ownership.isOwner(options.uid, groupName, function(err, isOwner) {
					if (err) {
						winston.warn('[groups.get] Could not determine ownership in group `' + groupName + '` for uid `' + options.uid + '`: ' + err.message);
						return next();
					}

					next(null, isOwner);
				});
			}
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
				results.base.name = !options.unescape ? validator.escape(results.base.name) : results.base.name;
				results.base.description = !options.unescape ? validator.escape(results.base.description) : results.base.description;
				results.base.descriptionParsed = descriptionParsed;
				results.base.userTitle = !options.unescape ? validator.escape(results.base.userTitle) : results.base.userTitle;
				results.base.userTitleEnabled = results.base.userTitleEnabled ? !!parseInt(results.base.userTitleEnabled, 10) : true;
				results.base.createtimeISO = utils.toISOString(results.base.createtime);
				results.base.members = results.users.filter(Boolean);
				results.base.pending = results.pending.filter(Boolean);
				results.base.count = numUsers || results.base.members.length;
				results.base.memberCount = numUsers || results.base.members.length;
				results.base.deleted = !!parseInt(results.base.deleted, 10);
				results.base.hidden = !!parseInt(results.base.hidden, 10);
				results.base.system = !!parseInt(results.base.system, 10);
				results.base.private = results.base.private ? !!parseInt(results.base.private, 10) : true;
				results.base.deletable = !results.base.system;
				results.base.truncated = truncated;
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
		plugins.fireHook('action:group.set', {field: field, value: value, type: 'set'});
		db.setObjectField('group:' + groupName, field, value, callback);
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
			db.isObjectFields('groupslug:groupName', slug, callback);
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
		});

		db.getObjects(keys, function(err, groupData) {
			if (err) {
				return callback(err);
			}
			groupData = groupData.map(function(group) {
				if (group) {
					group.userTitle = validator.escape(group.userTitle) || validator.escape(group.name);
					group.userTitleEnabled = group.userTitleEnabled ? parseInt(group.userTitleEnabled, 10) === 1 : true;
					group.labelColor = group.labelColor || '#000000';
					group.createtimeISO = utils.toISOString(group.createtime);
					group.hidden = parseInt(group.hidden, 10) === 1;

					if (!group['cover:url']) {
						group['cover:url'] = nconf.get('relative_path') + '/images/cover-default.png';
						group['cover:position'] = '50% 50%';
					}
				}
				return group;
			});

			plugins.fireHook('filter:groups.get', {groups: groupData}, function(err, data) {
				callback(err, data ? data.groups : null);
			});
		});
	};

	Groups.getUserGroups = function(uids, callback) {
		db.getSortedSetRevRange('groups:createtime', 0, -1, function(err, groupNames) {
			if (err) {
				return callback(err);
			}

			groupNames = groupNames.filter(function(groupName) {
				return groupName !== 'registered-users' && groupName.indexOf(':privileges:') === -1;
			});

			Groups.getMultipleGroupFields(groupNames, ['name', 'hidden'], function(err, groupData) {
				if (err) {
					return callback(err);
				}

				groupData = groupData.filter(function(group) {
					return group && !parseInt(group.hidden, 10);
				});

				var groupSets = groupData.map(function(group) {
					return 'group:' + group.name + ':members';
				});

				async.map(uids, function(uid, next) {
					db.isMemberOfSortedSets(groupSets, uid, function(err, isMembers) {
						if (err) {
							return next(err);
						}

						var memberOf = [];
						isMembers.forEach(function(isMember, index) {
							if (isMember) {
								memberOf.push(groupData[index].name);
							}
						});

						Groups.getGroupsData(memberOf, next);
					});
				}, callback);
			});
		});
	};
}(module.exports));
