'use strict';

(function(Groups) {

	/*  REMOVED
		group lists need to be updated to contain... groups!
	*/

	var async = require('async'),
		winston = require('winston'),
		user = require('./user'),
		db = require('./database');

	Groups.list = function(options, callback) {
		db.getSetMembers('groups', function (err, groupNames) {
			if (groupNames.length > 0) {
				async.map(groupNames, function (groupName, next) {
					Groups.get(groupName, options, next);
				}, function (err, groups) {
					// Remove system, hidden, or deleted groups from this list
					if (!options.showAllGroups) {
						groups = groups.filter(function (group) {
							if (group.deleted || (group.hidden && !group.system) || (!options.showSystemGroups && group.system)) {
								return false;
							} else {
								return true;
							}
						});
					}

					callback(err, groups);
				});
			} else {
				callback(null, []);
			}
		});
	};

	Groups.get = function(groupName, options, callback) {
		var	truncated = false,
			numUsers;

		async.parallel({
			base: function (next) {
				db.getObject('group:' + groupName, next);
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

			results.base.count = results.users.length;
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

	Groups.isMember = function(uid, groupName, callback) {
		db.isSetMember('group:' + groupName + ':members', uid, callback);
	};

	Groups.isMemberOfGroupList = function(uid, groupListKey, callback) {
		db.getSetMembers('group:' + groupListKey + ':members', function(err, gids) {
			async.some(gids, function(gid, next) {
				Groups.isMember(uid, gid, function(err, isMember) {
					if (!err && isMember) {
						next(true);
					} else {
						next(false);
					}
				});
			}, function(result) {
				callback(null, result);
			});
		});
	};

	Groups.exists = function(name, callback) {
		db.isSetMember('groups', name, callback);
	};

	Groups.create = function(name, description, callback) {
		if (name.length === 0) {
			return callback(new Error('name-too-short'));
		}

		if (name === 'administrators' || name === 'registered-users') {
			var system = true;
		}

		Groups.exists(name, function (err, exists) {
			if (!exists) {
				var groupData = {
					name: name,
					description: description,
					deleted: '0',
					hidden: '0',
					system: system ? '1' : '0'
				};

				db.setObject('group:' + name, groupData, function(err) {
					Groups.get(name, {}, callback);
				});
			} else {
				callback(new Error('group-exists'));
			}
		});
	};

	Groups.hide = function(groupName, callback) {
		Groups.update(groupName, {
			hidden: '1'
		}, callback);
	};

	Groups.update = function(groupName, values, callback) {
		db.exists('group:' + groupName, function (err, exists) {
			if (!err && exists) {
				// If the group was renamed, check for dupes
				if (values.name) {
					Groups.exists(values.name, function(err, exists) {
						if (!exists) {
							db.rename('group:' + groupName, 'group:' + values.name, function(err) {
								if (err) {
									return callback(new Error('could-not-rename-group'));
								}

								db.setRemove('groups', groupName);
								db.setAdd('groups', values.name);
								db.setObject('group:' + values.name, values, callback);
							});
						} else {
							callback(new Error('group-exists'));
						}
					});
				} else {
					db.setObject('group:' + groupName, values, callback);
				}
			} else {
				if (callback) {
					callback(new Error('gid-not-found'));
				}
			}
		});
	};

	Groups.destroy = function(groupName, callback) {
		async.parallel([
			function(next) {
				db.delete('group:' + groupName, next);
			},
			function(next) {
				db.setRemove('groups', groupName, next);
			}
		], callback);
	};

	Groups.join = function(groupName, uid, callback) {
		db.setAdd('group:' + groupName + ':members', uid, callback);
	};

	Groups.leave = function(groupName, uid, callback) {
		db.setRemove('group:' + groupName + ':members', uid, function(err) {
			if (err) {
				return callback(err);
			}

			// If this is a system group, and it is now empty, delete it
			Groups.get(groupName, function(err, group) {
				if (err) {
					return callback(err);
				}

				if (group.system && group.memberCount === 0) {
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
			});
		});
	};
}(module.exports));
