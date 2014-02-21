(function(Groups) {
	"use strict";

	var async = require('async'),
		user = require('./user'),
		db = require('./database');

	Groups.list = function(options, callback) {
		db.getObjectValues('group:gid', function (err, gids) {
			if (gids.length > 0) {
				async.map(gids, function (gid, next) {
					Groups.get(gid, {
						expand: options.expand
					}, next);
				}, function (err, groups) {
					// Remove deleted and hidden groups from this list
					callback(err, groups.filter(function (group) {
						if (parseInt(group.deleted, 10) === 1 || parseInt(group.hidden, 10) === 1) {
							return false;
						} else {
							return true;
						}
					}));
				});
			} else {
				callback(null, []);
			}
		});
	};

	Groups.listSystemGroups = function(options, callback) {
		var	systemGroups = ['administrators', 'registered-users'],
			humanNames = ['Administrators', 'Registered Users'];

		async.map(systemGroups, function(groupName, next) {
			Groups.getByGroupName(groupName, options, function(err, groupObj) {
				groupObj['name'] = humanNames[systemGroups.indexOf(groupObj['name'])];
				next(err, groupObj);
			});
		}, callback);
	};

	Groups.get = function(gid, options, callback) {
		async.parallel({
			base: function (next) {
				db.getObject('gid:' + gid, next);
			},
			users: function (next) {
				db.getSetMembers('gid:' + gid + ':members', function (err, uids) {
					if (options.expand) {
						if (err) {
							return next(err);
						}

						async.map(uids, function (uid, next) {
							user.getUserData(uid, next);
						}, function (err, users) {
							next(err, users);
						});
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

			results.base.deletable = results.base.hidden !== '1';

			callback(err, results.base);
		});
	};

	Groups.getByGroupName = function(groupName, options, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(new Error('gid-not-found'));
			} else {
				Groups.get(gid, options, callback);
			}
		});
	};

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

	Groups.isDeleted = function(gid, callback) {
		db.getObjectField('gid:' + gid, 'deleted', function(err, deleted) {
			callback(err, parseInt(deleted, 10) === 1);
		});
	};

	Groups.getGidFromName = function(name, callback) {
		db.getObjectField('group:gid', name, callback);
	};

	Groups.isMember = function(uid, gid, callback) {
		Groups.isDeleted(gid, function(err, deleted) {
			if (!deleted) {
				db.isSetMember('gid:' + gid + ':members', uid, callback);
			} else {
				callback(err, false);
			}
		});
	};

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
		})
	};

	Groups.isEmpty = function(gid, callback) {
		db.setCount('gid:' + gid + ':members', function(err, numMembers) {
			callback(err, numMembers === 0);
		});
	};

	Groups.isEmptyByGroupName = function(groupName, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(new Error('gid-not-found'));
			} else {
				Groups.isEmpty(gid, callback);
			}
		});
	};

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

	Groups.create = function(name, description, callback) {
		if (name.length === 0) {
			return callback(new Error('name-too-short'));
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
							hidden: '0'
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

	Groups.hide = function(gid, callback) {
		Groups.update(gid, {
			hidden: '1'
		}, callback);
	};

	Groups.update = function(gid, values, callback) {
		db.exists('gid:' + gid, function (err, exists) {
			if (!err && exists) {
				// If the group was renamed, check for dupes, fix the assoc. hash
				if (values['name']) {
					Groups.exists(values['name'], function(err, exists) {
						if (!exists) {
							Groups.get(gid, {}, function(err, groupObj) {
								if (err) {
									return callback(new Error('group-not-found'));
								}

								db.deleteObjectField('group:gid', groupObj['name']);
								db.setObjectField('group:gid', values['name'], gid);
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

	Groups.destroy = function(gid, callback) {
		db.setObjectField('gid:' + gid, 'deleted', '1', callback);
	};

	Groups.join = function(gid, uid, callback) {
		db.setAdd('gid:' + gid + ':members', uid, callback);
	};

	Groups.joinByGroupName = function(groupName, uid, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				Groups.create(groupName, '', function(err, groupObj) {
					async.parallel([
						function(next) {
							Groups.hide(groupObj.gid, next);
						},
						function(next) {
							Groups.join(groupObj.gid, uid, next);
						}
					], callback);
				});
			} else {
				Groups.join(gid, uid, callback);
			}
		});
	};

	Groups.leave = function(gid, uid, callback) {
		db.setRemove('gid:' + gid + ':members', uid, callback);
	};

	Groups.leaveByGroupName = function(groupName, uid, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(new Error('gid-not-found'));
			} else {
				Groups.leave(gid, uid, callback);
			}
		});
	};

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

	Groups.getCategoryAccess = function(cid, uid, callback){
		var access = false;
		// check user group read access level
		async.series([function(callback){
			// get groups with read permission
			db.getObjectField('group:gid', 'cid:' + cid + ':privileges:g+r', function(err, gid){
				// get the user groups that belong to this read group
				db.getSetMembers('gid:' + gid + ':members', function (err, gids) {
					// check if user belong to any of these user groups
					var groups_check = new Array();
					gids.forEach(function(cgid){
						groups_check.push(function(callback){
							Groups.isMember(uid, cgid, function(err, isMember){
								if (isMember){
									access = true;
								}
								callback(null, gids);
							})
						});
					});
					// do a series check. We want to make sure we check all the groups before determining if the user
					// has access or not.
					async.series(groups_check, function(err, results){
						callback(null, results);
					});
				});
			});

		}],
		function(err, results){
			// if the read group is empty we will asume that read access has been granted to ALL
			if (results[0].length == 0){ access = true; }
			callback(false, access);
		});
	};

}(module.exports));
