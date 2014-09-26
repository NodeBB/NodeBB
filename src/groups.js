'use strict';

var async = require('async'),
	winston = require('winston'),
	_ = require('underscore'),
	user = require('./user'),
	meta = require('./meta'),
	db = require('./database'),
	plugins = require('./plugins'),
	posts = require('./posts'),
	utils = require('../public/src/utils');


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
						if (group.deleted || (group.hidden && !group.system) || (!options.showSystemGroups && group.system)) {
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
			getEphemeralGroup: function(groupName, options, callback) {
				Groups.exists(groupName, function(err, exists) {
					if (!err && exists) {
						Groups.get.apply(null, arguments);
					} else {
						callback(null, {
							name: groupName,
							description: '',
							deleted: '0',
							hidden: '0',
							system: '1'
						});
					}
				});
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

	Groups.list = function(options, callback) {
		db.getSetMembers('groups', function (err, groupNames) {
			if (err) {
				return callback(err);
			}
			groupNames = groupNames.concat(ephemeralGroups);

			async.map(groupNames, function (groupName, next) {
				Groups.get(groupName, options, next);
			}, function (err, groups) {
				callback(err, internals.filterGroups(groups, options));
			});
		});
	};

	Groups.get = function(groupName, options, callback) {
		var	truncated = false,
			numUsers;

		async.parallel({
			base: function (next) {
				if (ephemeralGroups.indexOf(groupName) === -1) {
					db.getObject('group:' + groupName, function(err, groupObj) {
						if (err) {
							next(err);
						} else if (!groupObj) {
							next('group-not-found');
						} else {
							next(err, groupObj);
						}
					});
				} else {
					internals.getEphemeralGroup(groupName, options, next);
				}
			},
			users: function (next) {
				db.getSetMembers('group:' + groupName + ':members', function (err, uids) {
					if (err) {
						return next(err);
					}

					if (options.truncateUserList) {
						if (uids.length > 4) {
							numUsers = uids.length;
							uids.length = 4;
							truncated = true;
						}
					}

					if (options.expand) {
						async.map(uids, user.getUserData, next);
					} else {
						next(err, uids);
					}
				});
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			// User counts
			results.base.count = numUsers || results.users.length;
			results.base.members = results.users;
			results.base.memberCount = numUsers || results.users.length;

			results.base.deleted = !!parseInt(results.base.deleted, 10);
			results.base.hidden = !!parseInt(results.base.hidden, 10);
			results.base.system = !!parseInt(results.base.system, 10);
			results.base.deletable = !results.base.system;
			results.base.truncated = truncated;

			callback(err, results.base);
		});
	};

	Groups.search = function(query, options, callback) {
		if (query.length) {
			db.getSetMembers('groups', function(err, groups) {
				groups = groups.filter(function(groupName) {
					return groupName.match(new RegExp(utils.escapeRegexChars(query), 'i'));
				});

				async.map(groups, function(groupName, next) {
					Groups.get(groupName, options, next);
				}, function(err, groups) {
					callback(err, internals.filterGroups(groups, options));
				});
			});
		} else {
			callback(null, []);
		}
	};

	Groups.isMember = function(uid, groupName, callback) {
		db.isSetMember('group:' + groupName + ':members', uid, callback);
	};

	Groups.isMembers = function(uids, groupName, callback) {
		db.isSetMembers('group:' + groupName + ':members', uids, callback);
	};

	Groups.isMemberOfGroups = function(uid, groups, callback) {
		groups = groups.map(function(groupName) {
			return 'group:' + groupName + ':members';
		});
		db.isMemberOfSets(groups, uid, callback);
	};

	Groups.getMemberCount = function(groupName, callback) {
		db.setCount('group:' + groupName + ':members', callback);
	};

	Groups.isMemberOfGroupList = function(uid, groupListKey, callback) {
		db.getSetMembers('group:' + groupListKey + ':members', function(err, groupNames) {
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

		db.getSetsMembers(sets, function(err, members) {
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
		db.getSetMembers('group:' + groupListKey + ':members', function(err, groupNames) {
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

	Groups.exists = function(name, callback) {
		if (Array.isArray(name)) {
			db.isSetMembers('groups', name, callback);
		} else {
			db.isSetMember('groups', name, callback);
		}
	};

	Groups.create = function(name, description, callback) {
		if (name.length === 0) {
			return callback(new Error('[[error:group-name-too-short]]'));
		}

		if (name === 'administrators' || name === 'registered-users') {
			var system = true;
		}

		meta.userOrGroupExists(name, function (err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				return callback(new Error('[[error:group-already-exists]]'));
			}

			var groupData = {
				name: name,
				userTitle: name,
				description: description,
				deleted: '0',
				hidden: '0',
				system: system ? '1' : '0'
			};

			async.parallel([
				function(next) {
					db.setAdd('groups', name, next);
				},
				function(next) {
					db.setObject('group:' + name, groupData, function(err) {
						Groups.get(name, {}, next);
					});
				}
			], callback);
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

			db.setObject('group:' + groupName, {
				userTitle: values.userTitle || '',
				description: values.description || '',
				icon: values.icon || '',
				labelColor: values.labelColor || '#000000',
				hidden: values.hidden || '0'
			}, function(err) {
				if (err) {
					return callback(err);
				}

				renameGroup(groupName, values.name, callback);
			});
		});
	};

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
					function(next) {
						db.setObjectField('group:' + oldName, 'name', newName, next);
					},
					function(next) {
						db.getSetMembers('groups', function(err, groups) {
							if (err) {
								return next(err);
							}
							async.each(groups, function(group, next) {
								renameGroupMember('group:' + group + ':members', oldName, newName, next);
							}, next);
						});
					},
					function(next) {
						db.rename('group:' + oldName, 'group:' + newName, next);
					},
					function(next) {
						Groups.exists('group:' + oldName + ':members', function(err, exists) {
							if (err) {
								return next(err);
							}
							if (exists) {
								db.rename('group:' + oldName + ':members', 'group:' + newName + ':members', next);
							} else {
								next();
							}
						});
					},
					function(next) {
						renameGroupMember('groups', oldName, newName, next);
					}
				], callback);
			});
		});
	}

	function renameGroupMember(group, oldName, newName, callback) {
		db.isSetMember(group, oldName, function(err, isMember) {
			if (err || !isMember) {
				return callback(err);
			}
			async.series([
				function (next) {
					db.setRemove(group, oldName, next);
				},
				function (next) {
					db.setAdd(group, newName, next);
				}
			], callback);
		});
	}

	Groups.destroy = function(groupName, callback) {
		async.parallel([
			function(next) {
				db.delete('group:' + groupName, next);
			},
			function(next) {
				db.setRemove('groups', groupName, next);
			},
			function(next) {
				db.delete('group:' + groupName + ':members', next);
			},
			function(next) {
				db.getSetMembers('groups', function(err, groups) {
					if (err) {
						return next(err);
					}
					async.each(groups, function(group, next) {
						db.setRemove('group:' + group + ':members', groupName, next);
					}, next);
				});
			}
		], callback);
	};

	Groups.join = function(groupName, uid, callback) {
		callback = callback || function() {};

		Groups.exists(groupName, function(err, exists) {
			if (exists) {
				db.setAdd('group:' + groupName + ':members', uid, callback);
				plugins.fireHook('action:groups.join', {
					groupName: groupName,
					uid: uid
				});				
			} else {
				Groups.create(groupName, '', function(err) {
					if (err) {
						winston.error('[groups.join] Could not create new hidden group: ' + err.message);
						return callback(err);
					}
					Groups.hide(groupName);
					db.setAdd('group:' + groupName + ':members', uid, callback);
					plugins.fireHook('action:groups.join', {
						groupName: groupName,
						uid: uid
					});
				});
			}
		});
	};

	Groups.leave = function(groupName, uid, callback) {
		callback = callback || function() {};

		db.setRemove('group:' + groupName + ':members', uid, function(err) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('action:groups.leave', {
				groupName: groupName,
				uid: uid
			});

			// If this is a hidden group, and it is now empty, delete it
			Groups.get(groupName, {}, function(err, group) {
				if (err) {
					return callback(err);
				}

				if (group.hidden && group.memberCount === 0) {
					Groups.destroy(groupName, callback);
				} else {
					return callback();
				}
			});
		});
	};

	Groups.leaveAllGroups = function(uid, callback) {
		db.getSetMembers('groups', function(err, groups) {
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
		Groups.get(groupName, {}, function(err, groupObj) {
			if (err || parseInt(groupObj.memberCount, 10) === 0) {
				return callback(null, []);
			}

			var	keys = groupObj.members.map(function(uid) {
				return 'uid:' + uid + ':posts';
			});

			db.getSortedSetRevUnion(keys, 0, max-1, function(err, pids) {
				if (err) {
					return callback(err);
				}

				posts.getPostSummaryByPids(pids, uid, {stripTags: false}, callback);
			});
		});
	};

	Groups.getUserGroups = function(uids, callback) {
		db.getSetMembers('groups', function(err, groupNames) {
			if (err) {
				return callback(err);
			}

			var groupKeys = groupNames.filter(function(groupName) {
				return groupName !== 'registered-users' && groupName.indexOf(':privileges:') === -1;
			}).map(function(groupName) {
				return 'group:' + groupName;
			});

			db.getObjectsFields(groupKeys, ['name', 'hidden', 'userTitle', 'icon', 'labelColor'], function(err, groupData) {
				if (err) {
					return callback(err);
				}

				groupData = groupData.filter(function(group) {
					return parseInt(group.hidden, 10) !== 1 && !!group.userTitle;
				});

				var groupSets = groupData.map(function(group) {
					group.labelColor = group.labelColor || '#000000';
					return 'group:' + group.name + ':members';
				});

				async.map(uids, function(uid, next) {
					db.isMemberOfSets(groupSets, uid, function(err, isMembers) {
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
}(module.exports));
