
'use strict';

var async = require('async'),

	user = require('../user'),
	categories = require('../categories'),
	groups = require('../groups'),
	helpers = require('./helpers');


module.exports = function(privileges) {

	privileges.categories = {};

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
			if(err) {
				return callback(err);
			}

			var editable = results.isAdministrator || results.isModerator;

			callback(null, {
				'topics:create': results['topics:create'][0],
				editable: editable,
				view_deleted: editable,
				read: results.read[0]
			});
		});
	};

	privileges.categories.can = function(privilege, cid, uid, callback) {
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
		if (!cids.length) {
			return callback(null, []);
		}

		cids = cids.filter(function(cid, index, array) {
			return array.indexOf(cid) === index;
		});

		async.parallel({
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

			if (results.isAdmin) {
				return callback(null, cids);
			}

			cids = cids.filter(function(cid, index) {
				return results.allowedTo[index] || results.isModerators[index];
			});
			callback(null, cids);
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

	privileges.categories.isAdminOrMod = function(cids, uid, callback) {
		async.parallel({
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

			var returnData = new Array(cids.length);
			for (var i=0; i<cids.length; ++i) {
				returnData[i] = results.isAdmin || results.isModerators[i];
			}

			callback(null, returnData);
		});
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
