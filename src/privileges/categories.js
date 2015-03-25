
'use strict';

var async = require('async'),

	user = require('../user'),
	categories = require('../categories'),
	groups = require('../groups'),
	helpers = require('./helpers'),
	plugins = require('../plugins');

module.exports = function(privileges) {

	privileges.categories = {};

	privileges.categories.list = function(cid, callback) {
		// Method used in admin/category controller to show all users with privs in that given cid
		async.parallel({
			labels: function(next) {
				async.parallel({
					users: async.apply(plugins.fireHook, 'filter:privileges.list_human',
						['Find category', 'Access & Read', 'Create Topics', 'Reply to Topics', 'Moderator'].map(function(name) {
							return {
								name: name
							};
						})
					),
					groups: async.apply(plugins.fireHook, 'filter:privileges.groups.list_human',
						['Find category', 'Access & Read', 'Create Topics', 'Reply to Topics'].map(function(name) {
							return {
								name: name
							};
						})
					)
				}, next);
			},
			users: function(next) {
				var privileges;
				async.waterfall([
					async.apply(plugins.fireHook, 'filter:privileges.list', [
						'find', 'read', 'topics:create', 'topics:reply', 'mods'
					]),
					function(privs, next) {
						privileges = privs;
						groups.getMembersOfGroups(privs.map(function(privilege) {
							return 'cid:' + cid + ':privileges:' + privilege;
						}), next);
					},
					function(memberSets, next) {
						// Reduce into a single array
						var members = memberSets.reduce(function(combined, curMembers) {
								return combined.concat(curMembers);
							}).filter(function(member, index, combined) {
								return combined.indexOf(member) === index;
							});

						user.getMultipleUserFields(members, ['picture', 'username'], function(err, memberData) {
							memberData = memberData.map(function(member) {
								member.privileges = {};
								for(var x=0,numPrivs=privileges.length;x<numPrivs;x++) {
									member.privileges[privileges[x]] = memberSets[x].indexOf(member.uid) !== -1
								}

								return member;
							});

							next(null, memberData);
						});
					}
				], next);
			},
			groups: function(next) {
				var privileges;
				async.waterfall([
					async.apply(plugins.fireHook, 'filter:privileges.groups.list', [
						'groups:find', 'groups:read', 'groups:topics:create', 'groups:topics:reply'
					]),
					function(privs, next) {
						privileges = privs;
						groups.getMembersOfGroups(privs.map(function(privilege) {
							return 'cid:' + cid + ':privileges:' + privilege;
						}), next);
					},
					function(memberSets, next) {
						groups.list({
							expand: false,
							isAdmin: true,
							showSystemGroups: true
						}, function(err, memberData) {
							memberData = memberData.filter(function(member) {
								return member.name.indexOf(':privileges:') === -1;
							}).map(function(member) {
								member.privileges = {};
								for(var x=0,numPrivs=privileges.length;x<numPrivs;x++) {
									member.privileges[privileges[x]] = memberSets[x].indexOf(member.slug) !== -1
								}

								return {
									name: member.name,
									slug: member.slug,
									memberCount: member.memberCount,
									privileges: member.privileges,
								};
							});

							next(null, memberData);
						});
					}
				], next);
			}
		}, callback);
	};

	privileges.categories.get = function(cid, uid, callback) {
		async.parallel({
			'topics:create': function(next) {
				helpers.isUserAllowedTo('topics:create', uid, [cid], next);
			},
			read: function(next) {
				helpers.isUserAllowedTo('read', uid, [cid], next);
			},
			isAdministrator: function(next) {
				user.isAdministrator(uid, next);
			},
			isModerator: function(next) {
				user.isModerator(uid, cid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var isAdminOrMod = results.isAdministrator || results.isModerator;

			plugins.fireHook('filter:privileges.categories.get', {
				cid: cid,
				uid: uid,
				'topics:create': results['topics:create'][0] || isAdminOrMod,
				editable: isAdminOrMod,
				view_deleted: isAdminOrMod,
				read: results.read[0] || isAdminOrMod
			}, callback);
		});
	};

	privileges.categories.can = function(privilege, cid, uid, callback) {
		if (!cid) {
			return callback(null, false);
		}
		categories.getCategoryField(cid, 'disabled', function(err, disabled) {
			if (err) {
				return callback(err);
			}

			if (parseInt(disabled, 10) === 1) {
				return callback(null, false);
			}

			helpers.some([
				function(next) {
					helpers.isUserAllowedTo(privilege, uid, [cid], function(err, results) {
						next(err, Array.isArray(results) && results.length ? results[0] : false);
					});
				},
				function(next) {
					user.isModerator(uid, cid, next);
				},
				function(next) {
					user.isAdministrator(uid, next);
				}
			], callback);
		});
	};

	privileges.categories.filterCids = function(privilege, cids, uid, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}

		cids = cids.filter(function(cid, index, array) {
			return array.indexOf(cid) === index;
		});

		async.parallel({
			categories: function(next) {
				categories.getMultipleCategoryFields(cids, ['disabled'], next);
			},
			allowedTo: function(next) {
				helpers.isUserAllowedTo(privilege, uid, cids, next);
			},
			isModerators: function(next) {
				user.isModerator(uid, cids, next);
			},
			isAdmin: function(next) {
				user.isAdministrator(uid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			cids = cids.filter(function(cid, index) {
				return !results.categories[index].disabled &&
					(results.allowedTo[index] || results.isAdmin || results.isModerators[index]);
			});

			callback(null, cids.filter(Boolean));
		});
	};

	privileges.categories.filterUids = function(privilege, cid, uids, callback) {
		if (!uids.length) {
			return callback(null, []);
		}

		uids = uids.filter(function(uid, index, array) {
			return array.indexOf(uid) === index;
		});

		async.parallel({
			allowedTo: function(next) {
				helpers.isUsersAllowedTo(privilege, uids, cid, next);
			},
			isModerators: function(next) {
				user.isModerator(uids, cid, next);
			},
			isAdmin: function(next) {
				user.isAdministrator(uids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			uids = uids.filter(function(uid, index) {
				return results.allowedTo[index] || results.isModerators[index] || results.isAdmin[index];
			});
			callback(null, uids);
		});
	};

	privileges.categories.give = function(privileges, cid, groupName, callback) {
		async.each(privileges, function(privilege, next) {
			groups.join('cid:' + cid + ':privileges:groups:' + privilege, groupName, next);
		}, callback);
	};

	privileges.categories.rescind = function(privileges, cid, groupName, callback) {
		async.each(privileges, function(privilege, next) {
			groups.leave('cid:' + cid + ':privileges:groups:' + privilege, groupName, next);
		}, callback);
	};

	privileges.categories.canMoveAllTopics = function(currentCid, targetCid, uid, callback) {
		async.parallel({
			isAdministrator: function(next) {
				user.isAdministrator(uid, next);
			},
			moderatorOfCurrent: function(next) {
				user.isModerator(uid, currentCid, next);
			},
			moderatorOfTarget: function(next) {
				user.isModerator(uid, targetCid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			callback(null, results.isAdministrator || (results.moderatorOfCurrent && results.moderatorOfTarget));
		});
	};

	privileges.categories.userPrivileges = function(cid, uid, callback) {
		async.parallel({
			find: async.apply(groups.isMember, uid, 'cid:' + cid + ':privileges:find'),
			read: function(next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:read', next);
			},
			'topics:create': function(next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:topics:create', next);
			},
			'topics:reply': function(next) {
				groups.isMember(uid, 'cid:' + cid + ':privileges:topics:reply', next);
			},
			mods: function(next) {
				user.isModerator(uid, cid, next);
			}
		}, callback);
	};

	privileges.categories.groupPrivileges = function(cid, groupName, callback) {
		async.parallel({
			'groups:find': async.apply(groups.isMember, groupName, 'cid:' + cid + ':privileges:groups:find'),
			'groups:read': function(next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:read', next);
			},
			'groups:topics:create': function(next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:topics:create', next);
			},
			'groups:topics:reply': function(next) {
				groups.isMember(groupName, 'cid:' + cid + ':privileges:groups:topics:reply', next);
			}
		}, callback);
	};

};
