'use strict';

(function(Groups) {

	/*  REMOVED
		Groups.getGidFromName
		Groups.joinByGroupName
		Groups.leaveByGroupName
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

	// Not checked
	Groups.getByGroupName = function(groupName, options, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(new Error('gid-not-found'));
			} else {
				Groups.get(gid, options, callback);
			}
		});
	};

	// Not checked
	Groups.getMemberships = function(uid, callback) {
		if (!uid) {
			return callback(new Error('no-uid-specified'));
		}

		db.getObjectValues('group:gid', function(err, gids) {
			async.filter(gids, function(gid, next) {
				Groups.isMember(uid, gid, function(err, isMember) {
					next(isMember);
				});
			}, function(gids) {
				async.map(gids, function(gid, next) {
					Groups.get(gid, {}, next);
				}, callback);
			});
		});
	};

	// Not checked
	Groups.isDeleted = function(gid, callback) {
		db.getObjectField('gid:' + gid, 'deleted', function(err, deleted) {
			callback(err, parseInt(deleted, 10) === 1);
		});
	};

	Groups.isMember = function(uid, groupName, callback) {
		db.isSetMember('group:' + groupName + ':members', uid, callback);
	};

	// Not checked
	Groups.isMemberByGroupName = function(uid, groupName, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(null, false);
			} else {
				Groups.isMember(uid, gid, function(err, isMember) {
					callback(err, !!isMember);
				});
			}
		});
	};

	// Not checked
	Groups.isMemberOfGroupAny = function(uid, groupListKey, callback) {
		Groups.getGidFromName(groupListKey, function(err, gid) {
			if (err || !gid) {
				return callback(new Error('error-checking-group'));
			}

			db.getSetMembers('gid:' + gid + ':members', function(err, gids) {
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
		});
	};

	// Not checked
	Groups.isEmpty = function(gid, callback) {
		db.setCount('gid:' + gid + ':members', function(err, numMembers) {
			callback(err, numMembers === 0);
		});
	};

	// Not checked
	Groups.isEmptyByGroupName = function(groupName, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(new Error('gid-not-found'));
			} else {
				Groups.isEmpty(gid, callback);
			}
		});
	};

	// Not checked
	Groups.exists = function(name, callback) {
		async.parallel({
			exists: function(next) {
				db.isObjectField('group:gid', name, next);
			},
			deleted: function(next) {
				Groups.getGidFromName(name, function(err, gid) {
					Groups.isDeleted(gid, next);
				});
			}
		}, function(err, results) {
			callback(err, !results ? null : (results.exists && !results.deleted));
		});
	};

	// Not checked
	Groups.create = function(name, description, callback) {
		if (name.length === 0) {
			return callback(new Error('name-too-short'));
		}

		if (name === 'administrators' || name === 'registered-users') {
			var system = true;
		}

		Groups.exists(name, function (err, exists) {
			if (!exists) {
				db.incrObjectField('global', 'nextGid', function (err, gid) {
					db.setObjectField('group:gid', name, gid, function(err) {

						var groupData = {
							gid: gid,
							name: name,
							description: description,
							deleted: '0',
							hidden: '0',
							system: system ? '1' : '0'
						};

						db.setObject('gid:' + gid, groupData, function(err) {

							Groups.get(gid, {}, callback);

						});
					});
				});
			} else {
				callback(new Error('group-exists'));
			}
		});
	};

	// Not checked
	Groups.hide = function(gid, callback) {
		Groups.update(gid, {
			hidden: '1'
		}, callback);
	};

	// Not checked
	Groups.update = function(gid, values, callback) {
		db.exists('gid:' + gid, function (err, exists) {
			if (!err && exists) {
				// If the group was renamed, check for dupes, fix the assoc. hash
				if (values.name) {
					Groups.exists(values.name, function(err, exists) {
						if (!exists) {
							Groups.get(gid, {}, function(err, groupObj) {
								if (err) {
									return callback(new Error('group-not-found'));
								}

								db.deleteObjectField('group:gid', groupObj.name);
								db.setObjectField('group:gid', values.name, gid);
								db.setObject('gid:' + gid, values, callback);
							});
						} else {
							callback(new Error('group-exists'));
						}
					});
				} else {
					db.setObject('gid:' + gid, values, callback);
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

	// Not checked
	Groups.prune = function(callback) {
		// Actually deletes groups (with the deleted flag) from the redis database
		db.getObjectValues('group:gid', function (err, gids) {
			var groupsDeleted = 0;

			async.each(gids, function(gid, next) {
				Groups.get(gid, {}, function(err, groupObj) {
					if(err) {
						return next(err);
					}

					if (parseInt(groupObj.deleted, 10) === 1) {

						db.deleteObjectField('group:gid', groupObj.name, function(err) {
							db.delete('gid:' + gid, function(err) {
								groupsDeleted++;
								next(null);
							});
						});
					} else {
						next(null);
					}
				});
			}, function(err) {

				if (!err && process.env.NODE_ENV === 'development') {
					winston.info('[groups.prune] Pruned ' + groupsDeleted + ' deleted groups from Redis');
				}

				callback(err);
			});
		});
	};

}(module.exports));
