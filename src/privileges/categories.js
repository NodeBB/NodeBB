
'use strict';

var async = require('async'),

	user = require('../user'),
	groups = require('../groups'),
	helpers = require('./helpers');


module.exports = function(privileges) {

	privileges.categories = {};

	privileges.categories.get = function(cid, uid, callback) {
		async.parallel({
			'topics:create': function(next) {
				helpers.allowedTo('topics:create', uid, cid, next);
			},
			read: function(next) {
				helpers.allowedTo('read', uid, cid, next);
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
				'topics:create': results['topics:create'],
				editable: editable,
				view_deleted: editable,
				read: results.read
			});
		});
	};

	privileges.categories.can = function(privilege, cid, uid, callback) {
		helpers.some([
			function(next) {
				helpers.allowedTo(privilege, uid, cid, next);
			},
			function(next) {
				user.isModerator(uid, cid, next);
			},
			function(next) {
				user.isAdministrator(uid, next);
			}
		], callback);
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
			find: async.apply(helpers.isMember, groups.isMember, 'cid:' + cid + ':privileges:find', uid),
			read: function(next) {
				helpers.isMember(groups.isMember, 'cid:' + cid + ':privileges:read', uid, next);
			},
			'topics:create': function(next) {
				helpers.isMember(groups.isMember, 'cid:' + cid + ':privileges:topics:create', uid, next);
			},
			'topics:reply': function(next) {
				helpers.isMember(groups.isMember, 'cid:' + cid + ':privileges:topics:reply', uid, next);
			},
			mods: function(next) {
				user.isModerator(uid, cid, next);
			}
		}, callback);
	};

	privileges.categories.groupPrivileges = function(cid, groupName, callback) {
		async.parallel({
			'groups:find': async.apply(helpers.isMember, groups.isMember, 'cid:' + cid + ':privileges:groups:find', groupName),
			'groups:read': function(next) {
				helpers.isMember(groups.isMember, 'cid:' + cid + ':privileges:groups:read', groupName, function(err, isMember){
					next(err, !!isMember);
				});
			},
			'groups:topics:create': function(next) {
				helpers.isMember(groups.isMember, 'cid:' + cid + ':privileges:groups:topics:create', groupName, function(err, isMember){
					next(err, !!isMember);
				});
			},
			'groups:topics:reply': function(next) {
				helpers.isMember(groups.isMember, 'cid:' + cid + ':privileges:groups:topics:reply', groupName, function(err, isMember){
					next(err, !!isMember);
				});
			}
		}, callback);
	};

};
