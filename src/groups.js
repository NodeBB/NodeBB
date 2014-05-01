'use strict';

(function(Groups) {
	var async = require('async'),
		winston = require('winston'),
		user = require('./user'),
		db = require('./database'),
		utils = require('../public/src/utils'),

		filterGroups = function(groups, options) {
			// Remove system, hidden, or deleted groups from this list
			if (groups && !options.showAllGroups) {
				return groups.filter(function (group) {
					if (group.deleted || (group.hidden && !group.system) || (!options.showSystemGroups && group.system)) {
						return false;
					} else {
						return true;
					}
				});
			} else {
				return groups;
			}
		};

	Groups.list = function(options, callback) {
		db.getSetMembers('groups', function (err, groupNames) {
			if (groupNames.length > 0) {
				async.map(groupNames, function (groupName, next) {
					Groups.get(groupName, options, next);
				}, function (err, groups) {
					callback(err, filterGroups(groups, options));
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
				db.getObject('group:' + groupName, function(err, groupObj) {
					if (err) {
						next(err);
					} else if (!groupObj) {
						next('group-not-found');
					} else {
						next(err, groupObj);
					}
				});
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
					callback(err, filterGroups(groups, options));
				});
			});
		} else {
			callback(null, []);
		}
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
			return callback(new Error('[[error:group-name-too-short]]'));
		}

		if (name === 'administrators' || name === 'registered-users') {
			var system = true;
		}

		Groups.exists(name, function (err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				return callback(new Error('[[error:group-already-exists]]'));
			}

			var groupData = {
				name: name,
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
		Groups.update(groupName, {
			hidden: '1'
		}, callback);
	};

	Groups.update = function(groupName, values, callback) {
		db.exists('group:' + groupName, function (err, exists) {
			if (!err && exists) {
				// If the group was renamed, check for dupes
				if (!values.name) {
					db.setObject('group:' + groupName, values, callback);
				} else {
					if (callback) {
						callback(new Error('[[error:group-name-change-not-allowed]]'));
					}
				}
			} else {
				if (callback) {
					callback(new Error('[[error:no-group]]'));
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
			},
			function(next) {
				db.delete('group:' + groupName + ':members', next);
			}
		], callback);
	};

	Groups.join = function(groupName, uid, callback) {
		Groups.exists(groupName, function(err, exists) {
			if (exists) {
				db.setAdd('group:' + groupName + ':members', uid, callback);
			} else {
				Groups.create(groupName, '', function(err) {
					if (err) {
						winston.error('[groups.join] Could not create new hidden group: ' + err.message);
						return callback(err);
					}

					Groups.hide(groupName);
					db.setAdd('group:' + groupName + ':members', uid, callback);
				});
			}
		});
	};

	Groups.leave = function(groupName, uid, callback) {
		db.setRemove('group:' + groupName + ':members', uid, function(err) {
			if (err) {
				return callback(err);
			}

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
}(module.exports));
