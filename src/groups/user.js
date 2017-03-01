'use strict';

var async = require('async');

var db = require('../database');
var user = require('../user');

module.exports = function (Groups) {
	Groups.getUsersFromSet = function (set, callback) {
		async.waterfall([
			function (next) {
				db.getSetMembers(set, next);
			},
			function (uids, next) {
				user.getUsersData(uids, next);
			},
		], callback);
	};

	Groups.getUserGroups = function (uids, callback) {
		Groups.getUserGroupsFromSet('groups:visible:createtime', uids, callback);
	};

	Groups.getUserGroupsFromSet = function (set, uids, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRange(set, 0, -1, next);
			},
			function (groupNames, next) {
				async.map(uids, function (uid, next) {
					async.waterfall([
						function (next) {
							Groups.isMemberOfGroups(uid, groupNames, next);
						},
						function (isMembers, next) {
							var memberOf = [];
							isMembers.forEach(function (isMember, index) {
								if (isMember) {
									memberOf.push(groupNames[index]);
								}
							});

							Groups.getGroupsData(memberOf, next);
						},
					], next);
				}, next);
			},
		], callback);
	};
};
