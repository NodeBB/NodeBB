'use strict';

var async = require('async'),
	winston = require('winston'),
	_ = require('underscore'),
	crypto = require('crypto'),
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

	uploadsController = require('./controllers/uploads');

(function(Groups) {

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
			},
			isPrivilegeGroup: /^cid:\d+:privileges:[\w:]+$/
		};

	Groups.list = function(options, callback) {
		db.getSortedSetRevRange('groups:createtime', 0, -1, function (err, groupNames) {
			if (err) {
				return callback(err);
			}
			groupNames = groupNames.concat(ephemeralGroups);

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

	Groups.getGroups = function(start, end, callback) {
		db.getSortedSetRevRange('groups:createtime', start, end, callback);
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
							async.apply(async.map, uids, user.getUserData),
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
				results.base.name = validator.escape(results.base.name);
				results.base.description = validator.escape(results.base.description);
				results.base.descriptionParsed = descriptionParsed;
				results.base.userTitle = validator.escape(results.base.userTitle);
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
		db.getObjectFields('group:' + groupName, fields, callback);
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

	Groups.getMembers = function(groupName, start, end, callback) {
		db.getSortedSetRevRange('group:' + groupName + ':members', start, end, callback);
	};

	Groups.isMember = function(uid, groupName, callback) {
		if (!uid || parseInt(uid, 10) <= 0) {
			return callback(null, false);
		}
		db.isSortedSetMember('group:' + groupName + ':members', uid, callback);
	};

	Groups.isMembers = function(uids, groupName, callback) {
		db.isSortedSetMembers('group:' + groupName + ':members', uids, callback);
	};

	Groups.isMemberOfGroups = function(uid, groups, callback) {
		if (!uid || parseInt(uid, 10) <= 0) {
			return callback(null, groups.map(function() {return false;}));
		}
		groups = groups.map(function(groupName) {
			return 'group:' + groupName + ':members';
		});

		db.isMemberOfSortedSets(groups, uid, callback);
	};

	Groups.getMemberCount = function(groupName, callback) {
		db.getObjectField('group:' + groupName, 'memberCount', callback);
	};

	Groups.isMemberOfGroupList = function(uid, groupListKey, callback) {
		db.getSortedSetRange('group:' + groupListKey + ':members', 0, -1, function(err, groupNames) {
			if (err) {
				return callback(err);
			}
			groupNames = internals.removeEphemeralGroups(groupNames);
			if (groupNames.length === 0) {
				return callback(null, null);
			}

			Groups.isMemberOfGroups(uid, groupNames, function(err, isMembers) {
				if (err) {
					return callback(err);
				}

				callback(null, isMembers.indexOf(true) !== -1);
			});
		});
	};

	Groups.isMemberOfGroupsList = function(uid, groupListKeys, callback) {
		var sets = groupListKeys.map(function(groupName) {
			return 'group:' + groupName + ':members';
		});

		db.getSortedSetsMembers(sets, function(err, members) {
			if (err) {
				return callback(err);
			}

			var uniqueGroups = _.unique(_.flatten(members));
			uniqueGroups = internals.removeEphemeralGroups(uniqueGroups);

			Groups.isMemberOfGroups(uid, uniqueGroups, function(err, isMembers) {
				if (err) {
					return callback(err);
				}

				var map = {};

				uniqueGroups.forEach(function(groupName, index) {
					map[groupName] = isMembers[index];
				});

				var result = members.map(function(groupNames) {
					for (var i=0; i<groupNames.length; ++i) {
						if (map[groupNames[i]]) {
							return true;
						}
					}
					return false;
				});

				callback(null, result);
			});
		});
	};

	Groups.isMembersOfGroupList = function(uids, groupListKey, callback) {
		db.getSortedSetRange('group:' + groupListKey + ':members', 0, -1, function(err, groupNames) {
			if (err) {
				return callback(err);
			}

			var results = [];
			uids.forEach(function() {
				results.push(false);
			});

			groupNames = internals.removeEphemeralGroups(groupNames);
			if (groupNames.length === 0) {
				return callback(null, results);
			}

			async.each(groupNames, function(groupName, next) {
				Groups.isMembers(uids, groupName, function(err, isMembers) {
					if (err) {
						return next(err);
					}
					results.forEach(function(isMember, index) {
						if (!isMember && isMembers[index]) {
							results[index] = true;
						}
					});
					next();
				});
			}, function(err) {
				callback(err, results);
			});
		});
	};

	Groups.isInvited = function(uid, groupName, callback) {
		if (!uid) { return callback(null, false); }
		db.isSetMember('group:' + groupName + ':invited', uid, callback);
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
				async.apply(db.isObjectFields, 'groupslug:groupname', slugs),
				async.apply(db.isSortedSetMembers, 'groups:createtime', name)
			], function(err, results) {
				if (err) {
					return callback(err);
				}

				callback(null, results.map(function(result) {
					return result[0] || result[1] || result[2];
				}));
			});
		} else {
			var slug = utils.slugify(name);
			async.parallel([
				function(next) {
					next(null, ephemeralGroups.indexOf(slug) !== -1);
				},
				async.apply(db.isObjectField, 'groupslug:groupname', slug),
				async.apply(db.isSortedSetMember, 'groups:createtime', name)
			], function(err, results) {
				callback(err, !err ? (results[0] || results[1] || results[2]) : null);
			});
		}
	};

	Groups.existsBySlug = function(slug, callback) {
		db.isObjectField('groupslug:groupname', slug, callback);
	};

	Groups.create = function(data, callback) {
		if (data.name.length === 0) {
			return callback(new Error('[[error:group-name-too-short]]'));
		}

		if (data.name === 'administrators' || data.name === 'registered-users' || internals.isPrivilegeGroup.test(data.name)) {
			var system = true;
		}

		meta.userOrGroupExists(data.name, function (err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				return callback(new Error('[[error:group-already-exists]]'));
			}
			var now = Date.now();

			var slug = utils.slugify(data.name),
				groupData = {
					name: data.name,
					slug: slug,
					createtime: now,
					userTitle: data.name,
					description: data.description || '',
					memberCount: 0,
					deleted: '0',
					hidden: data.hidden || '0',
					system: system ? '1' : '0',
					'private': data.private || '1'
				},
				tasks = [
					async.apply(db.sortedSetAdd, 'groups:createtime', now, data.name),
					async.apply(db.setObject, 'group:' + data.name, groupData)
				];

			if (data.hasOwnProperty('ownerUid')) {
				tasks.push(async.apply(db.setAdd, 'group:' + data.name + ':owners', data.ownerUid));
				tasks.push(async.apply(db.sortedSetAdd, 'group:' + data.name + ':members', now, data.ownerUid));
			}

			if (!data.hidden) {
				tasks.push(async.apply(db.setObjectField, 'groupslug:groupname', slug, data.name));
			}

			async.parallel(tasks, function(err) {
				if (!err) {
					plugins.fireHook('action:group.create', groupData);
				}

				callback(err);
			});
		});
	};

	Groups.hide = function(groupName, callback) {
		callback = callback || function() {};
		db.setObjectField('group:' + groupName, 'hidden', 1, callback);
	};

	Groups.update = function(groupName, values, callback) {
		callback = callback || function() {};
		db.exists('group:' + groupName, function (err, exists) {
			if (err || !exists) {
				return callback(err || new Error('[[error:no-group]]'));
			}

			var payload = {
					userTitle: values.userTitle || '',
					description: values.description || '',
					icon: values.icon || '',
					labelColor: values.labelColor || '#000000',
					hidden: values.hidden === true ? '1' : '0',
					'private': values.private === false ? '0' : '1'
				};

			async.series([
				async.apply(updatePrivacy, groupName, values.private),
				async.apply(db.setObject, 'group:' + groupName, payload),
				async.apply(renameGroup, groupName, values.name)
			], function(err) {
				if (err) {
					return callback(err);
				}

				plugins.fireHook('action:group.update', {
					name: groupName,
					values: values
				});
				callback();
			});
		});
	};

	function updatePrivacy(groupName, newValue, callback) {
		// Grab the group's current privacy value
		Groups.getGroupFields(groupName, ['private'], function(err, currentValue) {
			currentValue = currentValue.private === '1';	// Now a Boolean

			if (currentValue !== newValue && currentValue === true) {
				// Group is now public, so all pending users are automatically considered members
				db.getSetMembers('group:' + groupName + ':pending', function(err, uids) {
					if (err) { return callback(err); }
					else if (!uids) { return callback(); }	// No pending users, we're good to go

					var now = Date.now(),
						scores = uids.map(function() { return now; });	// There's probably a better way to initialise an Array of size x with the same value...

					winston.verbose('[groups.update] Group is now public, automatically adding ' + uids.length + ' new members, who were pending prior.');
					async.series([
						async.apply(db.sortedSetAdd, 'group:' + groupName + ':members', scores, uids),
						async.apply(db.delete, 'group:' + groupName + ':pending')
					], callback);
				});
			} else {
				callback();
			}
		});
	}

	function renameGroup(oldName, newName, callback) {
		if (oldName === newName || !newName || newName.length === 0) {
			return callback();
		}

		db.getObject('group:' + oldName, function(err, group) {
			if (err || !group) {
				return callback(err);
			}

			if (parseInt(group.system, 10) === 1 || parseInt(group.hidden, 10) === 1) {
				return callback();
			}

			Groups.exists(newName, function(err, exists) {
				if (err || exists) {
					return callback(err || new Error('[[error:group-already-exists]]'));
				}

				async.series([
					async.apply(db.setObjectField, 'group:' + oldName, 'name', newName),
					async.apply(db.setObjectField, 'group:' + oldName, 'slug', utils.slugify(newName)),
					async.apply(db.deleteObjectField, 'groupslug:groupname', group.slug),
					async.apply(db.setObjectField, 'groupslug:groupname', utils.slugify(newName), newName),
					function(next) {
						db.getSortedSetRange('groups:createtime', 0, -1, function(err, groups) {
							if (err) {
								return next(err);
							}
							async.each(groups, function(group, next) {
								renameGroupMember('group:' + group + ':members', oldName, newName, next);
							}, next);
						});
					},
					async.apply(db.rename, 'group:' + oldName, 'group:' + newName),
					async.apply(db.rename, 'group:' + oldName + ':members', 'group:' + newName + ':members'),
					async.apply(db.rename, 'group:' + oldName + ':owners', 'group:' + newName + ':owners'),
					async.apply(db.rename, 'group:' + oldName + ':pending', 'group:' + newName + ':pending'),
					async.apply(db.rename, 'group:' + oldName + ':invited', 'group:' + newName + ':invited'),
					async.apply(renameGroupMember, 'groups:createtime', oldName, newName),
					function(next) {
						plugins.fireHook('action:group.rename', {
							old: oldName,
							new: newName
						});

						next();
					}
				], callback);
			});
		});
	}

	function renameGroupMember(group, oldName, newName, callback) {
		db.isSortedSetMember(group, oldName, function(err, isMember) {
			if (err || !isMember) {
				return callback(err);
			}
			var score;
			async.waterfall([
				function (next) {
					db.sortedSetScore(group, oldName, next);
				},
				function (_score, next) {
					score = _score;
					db.sortedSetRemove(group, oldName, next);
				},
				function (next) {
					db.sortedSetAdd(group, score, newName, next);
				}
			], callback);
		});
	}

	Groups.destroy = function(groupName, callback) {
		Groups.get(groupName, {}, function(err, groupObj) {
			plugins.fireHook('action:group.destroy', groupObj);

			async.parallel([
				async.apply(db.delete, 'group:' + groupName),
				async.apply(db.sortedSetRemove, 'groups:createtime', groupName),
				async.apply(db.delete, 'group:' + groupName + ':members'),
				async.apply(db.delete, 'group:' + groupName + ':pending'),
				async.apply(db.delete, 'group:' + groupName + ':invited'),
				async.apply(db.delete, 'group:' + groupName + ':owners'),
				async.apply(db.deleteObjectField, 'groupslug:groupname', utils.slugify(groupName)),
				function(next) {
					db.getSortedSetRange('groups:createtime', 0, -1, function(err, groups) {
						if (err) {
							return next(err);
						}
						async.each(groups, function(group, next) {
							db.sortedSetRemove('group:' + group + ':members', groupName, next);
						}, next);
					});
				}
			], callback);
		});
	};

	Groups.join = function(groupName, uid, callback) {
		function join() {
			var tasks = [
				async.apply(db.sortedSetAdd, 'group:' + groupName + ':members', Date.now(), uid),
				async.apply(db.incrObjectField, 'group:' + groupName, 'memberCount')
			];

			async.waterfall([
				function(next) {
					user.isAdministrator(uid, next);
				},
				function(isAdmin, next) {
					if (isAdmin) {
						tasks.push(async.apply(db.setAdd, 'group:' + groupName + ':owners', uid));
					}
					async.parallel(tasks, next);
				}
			], function(err, results) {
				if (err) {
					return callback(err);
				}
				plugins.fireHook('action:group.join', {
					groupName: groupName,
					uid: uid
				});
				callback();
			});
		}

		callback = callback || function() {};

		Groups.exists(groupName, function(err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				return join();
			}

			Groups.create({
				name: groupName,
				description: '',
				hidden: 1
			}, function(err) {
				if (err && err.message !== '[[error:group-already-exists]]') {
					winston.error('[groups.join] Could not create new hidden group: ' + err.message);
					return callback(err);
				}
				join();
			});
		});
	};

	Groups.requestMembership = function(groupName, uid, callback) {
		async.parallel({
			exists: async.apply(Groups.exists, groupName),
			isMember: async.apply(Groups.isMember, uid, groupName)
		}, function(err, checks) {
			if (!checks.exists) {
				return callback(new Error('[[error:no-group]]'));
			} else if (checks.isMember) {
				return callback(new Error('[[error:group-already-member]]'));
			}

			if (parseInt(uid, 10) > 0) {
				db.setAdd('group:' + groupName + ':pending', uid, callback);
				plugins.fireHook('action:group.requestMembership', {
					groupName: groupName,
					uid: uid
				});
			} else {
				callback(new Error('[[error:not-logged-in]]'));
			}
		});
	};

	Groups.acceptMembership = function(groupName, uid, callback) {
		// Note: For simplicity, this method intentially doesn't check the caller uid for ownership!
		async.waterfall([
			async.apply(db.setRemove, 'group:' + groupName + ':pending', uid),
			async.apply(db.setRemove, 'group:' + groupName + ':invited', uid),
			async.apply(Groups.join, groupName, uid)
		], callback);
	};

	Groups.rejectMembership = function(groupName, uid, callback) {
		// Note: For simplicity, this method intentially doesn't check the caller uid for ownership!
		async.parallel([
			async.apply(db.setRemove, 'group:' + groupName + ':pending', uid),
			async.apply(db.setRemove, 'group:' + groupName + ':invited', uid)
		], callback);
	};

	Groups.invite = function(groupName, uid, callback) {
		async.parallel({
			exists: async.apply(Groups.exists, groupName),
			isMember: async.apply(Groups.isMember, uid, groupName)
		}, function(err, checks) {
			if (!checks.exists) {
				return callback(new Error('[[error:no-group]]'));
			} else if (checks.isMember) {
				return callback(new Error('[[error:group-already-member]]'));
			}

			if (parseInt(uid, 10) > 0) {
				db.setAdd('group:' + groupName + ':invited', uid, callback);
				plugins.fireHook('action:group.inviteMember', {
					groupName: groupName,
					uid: uid
				});
			} else {
				callback(new Error('[[error:not-logged-in]]'));
			}
		});
	};

	Groups.leave = function(groupName, uid, callback) {
		callback = callback || function() {};

		var tasks = [
			async.apply(db.sortedSetRemove, 'group:' + groupName + ':members', uid),
			async.apply(db.setRemove, 'group:' + groupName + ':owners', uid),
			async.apply(db.decrObjectField, 'group:' + groupName, 'memberCount')
		];

		async.parallel(tasks, function(err) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('action:group.leave', {
				groupName: groupName,
				uid: uid
			});

			// If this is a hidden group, and it is now empty, delete it
			Groups.get(groupName, {}, function(err, group) {
				if (err || !group) {
					return callback(err);
				}

				if (group.hidden && group.memberCount === 0) {
					Groups.destroy(groupName, callback);
				} else {
					callback();
				}
			});
		});
	};

	Groups.leaveAllGroups = function(uid, callback) {
		db.getSortedSetRange('groups:createtime', 0, -1, function(err, groups) {
			if (err) {
				return callback(err);
			}
			async.each(groups, function(groupName, next) {
				Groups.isMember(uid, groupName, function(err, isMember) {
					if (!err && isMember) {
						Groups.leave(groupName, uid, next);
					} else {
						next();
					}
				});
			}, callback);
		});
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

			Groups.getGroupsData(groupNames, function(err, groupData) {
				if (err) {
					return callback(err);
				}

				groupData = groupData.filter(function(group) {
					return group && parseInt(group.hidden, 10) !== 1 && !!group.userTitle;
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
								memberOf.push(groupData[index]);
							}
						});

						next(null, memberOf);
					});
				}, callback);
			});
		});
	};

	Groups.updateCoverPosition = function(groupName, position, callback) {
		Groups.setGroupField(groupName, 'cover:position', position, callback);
	};

	Groups.updateCover = function(data, callback) {
		var tempPath, md5sum, url;

		// Position only? That's fine
		if (!data.imageData && data.position) {
			return Groups.updateCoverPosition(data.groupName, data.position, callback);
		}

		async.series([
			function(next) {
				// Calculate md5sum of image
				// This is required because user data can be private
				md5sum = crypto.createHash('md5');
				md5sum.update(data.imageData);
				md5sum = md5sum.digest('hex');
				next();
			},
			function(next) {
				// Save image
				tempPath = path.join(nconf.get('base_dir'), nconf.get('upload_path'), md5sum);
				var buffer = new Buffer(data.imageData.slice(data.imageData.indexOf('base64') + 7), 'base64');

				fs.writeFile(tempPath, buffer, {
					encoding: 'base64'
				}, next);
			},
			function(next) {
				uploadsController.uploadGroupCover({
					path: tempPath
				}, function(err, uploadData) {
					if (err) {
						return next(err);
					}

					url = uploadData.url;
					next();
				});
			},
			function(next) {
				Groups.setGroupField(data.groupName, 'cover:url', url, next);
			},
			function(next) {
				fs.unlink(tempPath, next);	// Delete temporary file
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			Groups.updateCoverPosition(data.groupName, data.position, callback);
		});
	};

	Groups.ownership = {};

	Groups.ownership.isOwner = function(uid, groupName, callback) {
		// Note: All admins automatically become owners upon joining
		db.isSetMember('group:' + groupName + ':owners', uid, callback);
	};

	Groups.ownership.grant = function(toUid, groupName, callback) {
		// Note: No ownership checking is done here on purpose!
		db.setAdd('group:' + groupName + ':owners', toUid, callback);
	};

	Groups.ownership.rescind = function(toUid, groupName, callback) {
		// Note: No ownership checking is done here on purpose!

		// If the owners set only contains one member, error out!
		db.setCount('group:' + groupName + ':owners', function(err, numOwners) {
			if (numOwners <= 1) {
				return callback(new Error('[[error:group-needs-owner]]'));
			}

			db.setRemove('group:' + groupName + ':owners', toUid, callback);
		});
	};

	Groups.search = function(query, options, callback) {
		if (!query) {
			query = '';
		}

		async.waterfall([
			async.apply(db.getObjectValues, 'groupslug:groupname'),
			function(groupNames, next) {
				groupNames = groupNames.filter(function(name) {
					return name.match(new RegExp(query, 'i')) && name !== 'administrators';
				});

				async.mapLimit(groupNames, 5, function(groupName, next) {
					Groups.get(groupName, options || {}, next);
				}, next);
			},
			async.apply(Groups.sort, options.sort)
		], callback);
	};

	Groups.sort = function(strategy, groups, next) {
		switch(strategy) {
			case 'count':
				groups = groups.sort(function(a, b) {
					return a.slug > b.slug;
				}).sort(function(a, b) {
					return a.memberCount < b.memberCount;
				});
				break;

			case 'date':
				groups = groups.sort(function(a, b) {
					return a.createtime < b.createtime;
				});
				break;

			case 'alpha':	// intentional fall-through
			default:
				groups = groups.sort(function(a, b) {
					return a.slug > b.slug;
				});
		}

		next(null, groups);
	};

}(module.exports));
