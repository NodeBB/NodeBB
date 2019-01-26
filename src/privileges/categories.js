
'use strict';

var async = require('async');
var _ = require('lodash');

var categories = require('../categories');
var user = require('../user');
var groups = require('../groups');
var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.categories = {};

	privileges.categories.list = function (cid, callback) {
		// Method used in admin/category controller to show all users/groups with privs in that given cid
		async.waterfall([
			function (next) {
				async.parallel({
					labels: function (next) {
						async.parallel({
							users: async.apply(plugins.fireHook, 'filter:privileges.list_human', privileges.privilegeLabels.slice()),
							groups: async.apply(plugins.fireHook, 'filter:privileges.groups.list_human', privileges.privilegeLabels.slice()),
						}, next);
					},
					users: function (next) {
						helpers.getUserPrivileges(cid, 'filter:privileges.list', privileges.userPrivilegeList, next);
					},
					groups: function (next) {
						helpers.getGroupPrivileges(cid, 'filter:privileges.groups.list', privileges.groupPrivilegeList, next);
					},
				}, next);
			},
			function (payload, next) {
				// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
				payload.columnCountUser = payload.labels.users.length + 2;
				payload.columnCountUserOther = payload.labels.users.length - privileges.privilegeLabels.length;
				payload.columnCountGroup = payload.labels.groups.length + 2;
				payload.columnCountGroupOther = payload.labels.groups.length - privileges.privilegeLabels.length;
				next(null, payload);
			},
		], callback);
	};

	privileges.categories.get = function (cid, uid, callback) {
		var privs = ['topics:create', 'topics:read', 'topics:tag', 'read'];
		async.waterfall([
			function (next) {
				async.parallel({
					privileges: function (next) {
						helpers.isUserAllowedTo(privs, uid, cid, next);
					},
					isAdministrator: function (next) {
						user.isAdministrator(uid, next);
					},
					isModerator: function (next) {
						user.isModerator(uid, cid, next);
					},
				}, next);
			},
			function (results, next) {
				var privData = _.zipObject(privs, results.privileges);
				var isAdminOrMod = results.isAdministrator || results.isModerator;

				plugins.fireHook('filter:privileges.categories.get', {
					'topics:create': privData['topics:create'] || isAdminOrMod,
					'topics:read': privData['topics:read'] || isAdminOrMod,
					'topics:tag': privData['topics:tag'] || isAdminOrMod,
					read: privData.read || isAdminOrMod,
					cid: cid,
					uid: uid,
					editable: isAdminOrMod,
					view_deleted: isAdminOrMod,
					isAdminOrMod: isAdminOrMod,
				}, next);
			},
		], callback);
	};

	privileges.categories.isAdminOrMod = function (cid, uid, callback) {
		if (parseInt(uid, 10) <= 0) {
			return setImmediate(callback, null, false);
		}
		helpers.some([
			function (next) {
				user.isModerator(uid, cid, next);
			},
			function (next) {
				user.isAdministrator(uid, next);
			},
		], callback);
	};

	privileges.categories.isUserAllowedTo = function (privilege, cid, uid, callback) {
		if (!cid) {
			return callback(null, false);
		}
		if (Array.isArray(cid)) {
			helpers.isUserAllowedTo(privilege, uid, cid, function (err, results) {
				callback(err, Array.isArray(results) && results.length ? results : false);
			});
		} else {
			helpers.isUserAllowedTo(privilege, uid, [cid], function (err, results) {
				callback(err, Array.isArray(results) && results.length ? results[0] : false);
			});
		}
	};

	privileges.categories.can = function (privilege, cid, uid, callback) {
		if (!cid) {
			return callback(null, false);
		}

		async.waterfall([
			function (next) {
				categories.getCategoryField(cid, 'disabled', next);
			},
			function (disabled, next) {
				if (disabled) {
					return callback(null, false);
				}
				helpers.some([
					function (next) {
						helpers.isUserAllowedTo(privilege, uid, [cid], function (err, results) {
							next(err, Array.isArray(results) && results.length ? results[0] : false);
						});
					},
					function (next) {
						user.isModerator(uid, cid, next);
					},
					function (next) {
						user.isAdministrator(uid, next);
					},
				], next);
			},
		], callback);
	};

	privileges.categories.filterCids = function (privilege, cids, uid, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}

		cids = _.uniq(cids);

		async.waterfall([
			function (next) {
				privileges.categories.getBase(privilege, cids, uid, next);
			},
			function (results, next) {
				cids = cids.filter(function (cid, index) {
					return !results.categories[index].disabled &&
						(results.allowedTo[index] || results.isAdmin || results.isModerators[index]);
				});

				next(null, cids.filter(Boolean));
			},
		], callback);
	};

	privileges.categories.getBase = function (privilege, cids, uid, callback) {
		async.parallel({
			categories: function (next) {
				categories.getCategoriesFields(cids, ['disabled'], next);
			},
			allowedTo: function (next) {
				helpers.isUserAllowedTo(privilege, uid, cids, next);
			},
			isModerators: function (next) {
				user.isModerator(uid, cids, next);
			},
			isAdmin: function (next) {
				user.isAdministrator(uid, next);
			},
		}, callback);
	};

	privileges.categories.filterUids = function (privilege, cid, uids, callback) {
		if (!uids.length) {
			return callback(null, []);
		}

		uids = _.uniq(uids);

		async.waterfall([
			function (next) {
				async.parallel({
					allowedTo: function (next) {
						helpers.isUsersAllowedTo(privilege, uids, cid, next);
					},
					isModerators: function (next) {
						user.isModerator(uids, cid, next);
					},
					isAdmins: function (next) {
						user.isAdministrator(uids, next);
					},
				}, next);
			},
			function (results, next) {
				uids = uids.filter(function (uid, index) {
					return results.allowedTo[index] || results.isModerators[index] || results.isAdmins[index];
				});
				next(null, uids);
			},
		], callback);
	};

	privileges.categories.give = function (privileges, cid, groupName, callback) {
		helpers.giveOrRescind(groups.join, privileges, cid, groupName, callback);
	};

	privileges.categories.rescind = function (privileges, cid, groupName, callback) {
		helpers.giveOrRescind(groups.leave, privileges, cid, groupName, callback);
	};

	privileges.categories.canMoveAllTopics = function (currentCid, targetCid, uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					isAdministrator: function (next) {
						user.isAdministrator(uid, next);
					},
					moderatorOfCurrent: function (next) {
						user.isModerator(uid, currentCid, next);
					},
					moderatorOfTarget: function (next) {
						user.isModerator(uid, targetCid, next);
					},
				}, next);
			},
			function (results, next) {
				next(null, results.isAdministrator || (results.moderatorOfCurrent && results.moderatorOfTarget));
			},
		], callback);
	};

	privileges.categories.userPrivileges = function (cid, uid, callback) {
		var tasks = {};

		privileges.userPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = async.apply(groups.isMember, uid, 'cid:' + cid + ':privileges:' + privilege);
		});

		async.parallel(tasks, callback);
	};

	privileges.categories.groupPrivileges = function (cid, groupName, callback) {
		var tasks = {};

		privileges.groupPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = async.apply(groups.isMember, groupName, 'cid:' + cid + ':privileges:' + privilege);
		});

		async.parallel(tasks, callback);
	};
};
