'use strict';

var async = require('async'),
	winston = require('winston'),
	_ = require('underscore'),
	crypto = require('crypto'),
	path = require('path'),
	nconf = require('nconf'),
	fs = require('fs'),

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
			}/*,
			fixImageUrl: function(url) {
				if (url) {
					return url.indexOf('http') === -1 ? nconf.get('relative_path') + url : url;
				}
			}*/
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
					db.getObject('group:' + groupName, next);
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
								}, next);
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

					if (options.expand) {
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
			if (err || !results.base) {
				return callback(err);
			}

			// Default image
			if (!results.base['cover:url']) {
				results.base['cover:url'] = nconf.get('relative_path') + '/images/cover-default.png';
				results.base['cover:position'] = '50% 50%';
			}

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
			results.base.isOwner = results.isOwner;

			callback(err, results.base);
		});
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

	Groups.getMembers = function(groupName, callback) {
		db.getSetMembers('group:' + groupName + ':members', callback);
	};

	Groups.search = function(query, options, callback) {
		if (!query) {
			return callback(null, []);
		}

		db.getSetMembers('groups', function(err, groups) {
			if (err) {
				return callback(err);
			}
			groups = groups.filter(function(groupName) {
				return groupName.match(new RegExp(utils.escapeRegexChars(query), 'i'));
			});

			async.map(groups, function(groupName, next) {
				Groups.get(groupName, options, next);
			}, function(err, groups) {
				callback(err, internals.filterGroups(groups, options));
			});
		});
	};

	Groups.isMember = function(uid, groupName, callback) {
		if (!uid || parseInt(uid, 10) <= 0) {
			return callback(null, false);
		}
		db.isSetMember('group:' + groupName + ':members', uid, callback);
	};

	Groups.isMembers = function(uids, groupName, callback) {
		db.isSetMembers('group:' + groupName + ':members', uids, callback);
	};

	Groups.isMemberOfGroups = function(uid, groups, callback) {
		if (!uid || parseInt(uid, 10) <= 0) {
			return callback(null, groups.map(function() {return false;}));
		}
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

	Groups.create = function(data, callback) {
		if (data.name.length === 0) {
			return callback(new Error('[[error:group-name-too-short]]'));
		}

		if (data.name === 'administrators' || data.name === 'registered-users') {
			var system = true;
		}

		meta.userOrGroupExists(data.name, function (err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				return callback(new Error('[[error:group-already-exists]]'));
			}

			var groupData = {
					name: data.name,
					userTitle: data.name,
					description: data.description || '',
					deleted: '0',
					hidden: '0',
					system: system ? '1' : '0',
					'private': data.private || '1'
				},
				tasks = [
					async.apply(db.setAdd, 'groups', data.name),
					async.apply(db.setObject, 'group:' + data.name, groupData)
				];

			if (data.hasOwnProperty('ownerUid')) {
				tasks.push(async.apply(db.setAdd, 'group:' + data.name + ':owners', data.ownerUid));
				tasks.push(async.apply(db.setAdd, 'group:' + data.name + ':members', data.ownerUid));
			}

			async.parallel(tasks, callback);
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

			var values = {
					userTitle: values.userTitle || '',
					description: values.description || '',
					icon: values.icon || '',
					labelColor: values.labelColor || '#000000',
					hidden: values.hidden || '0',
					'private': values.private === false ? '0' : '1'
				};

			db.setObject('group:' + groupName, values, function(err) {
				if (err) {
					return callback(err);
				}

				plugins.fireHook('action:group.updated', {
					name: 'group:' + groupName,
					values: values
				});
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
						db.exists('group:' + oldName + ':members', function(err, exists) {
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
					},
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
			async.apply(db.delete, 'group:' + groupName),
			async.apply(db.setRemove, 'groups', groupName),
			async.apply(db.delete, 'group:' + groupName + ':members'),
			async.apply(db.delete, 'group:' + groupName + ':pending'),
			async.apply(db.delete, 'group:' + groupName + ':owners'),
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
				Groups.create({
					name: groupName,
					description: ''
				}, function(err) {
					if (err && err.message !== '[[error:group-already-exists]]') {
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

	Groups.requestMembership = function(groupName, uid, callback) {
		db.setAdd('group:' + groupName + ':pending', uid, callback);
		plugins.fireHook('action:groups.requestMembership', {
			groupName: groupName,
			uid: uid
		});
	};

	Groups.acceptMembership = function(groupName, uid, callback) {
		// Note: For simplicity, this method intentially doesn't check the caller uid for ownership!
		db.setRemove('group:' + groupName + ':pending', uid, callback);
		Groups.join.apply(Groups, arguments);
	};

	Groups.rejectMembership = function(groupName, uid, callback) {
		// Note: For simplicity, this method intentially doesn't check the caller uid for ownership!
		db.setRemove('group:' + groupName + ':pending', uid, callback);
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
				if (err || !group) {
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
		async.waterfall([
			function(next) {
				Groups.getMembers(groupName, next);
			},
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
	}

	Groups.ownership = {};

	Groups.ownership.isOwner = function(uid, groupName, callback) {
		// Note: All admins are also owners
		async.waterfall([
			async.apply(db.isSetMember, 'group:' + groupName + ':owners', uid),
			function(isOwner, next) {
				if (isOwner) {
					return next(null, isOwner);
				}

				user.isAdministrator(uid, next);
			}
		], callback);
	};

	Groups.ownership.grant = function(toUid, groupName, callback) {
		// Note: No ownership checking is done here on purpose!
		db.setAdd('group:' + groupName + ':owners', toUid, callback);
	};

	Groups.ownership.rescind = function(toUid, groupName, callback) {
		// Note: No ownership checking is done here on purpose!
		db.setRemove('group:' + groupName + ':owners', toUid, callback);
	};

}(module.exports));
