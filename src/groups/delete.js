'use strict';

var async = require('async');
var plugins = require('../plugins');
var utils = require('../utils');
var db = require('./../database');
var batch = require('../batch');

module.exports = function (Groups) {
	Groups.destroy = function (groupNames, callback) {
		if (!Array.isArray(groupNames)) {
			groupNames = [groupNames];
		}

		var groupsData;
		async.waterfall([
			function (next) {
				console.log(1);
				Groups.getGroupsData(groupNames, next);
			},
			function (_groupsData, next) {
				console.log(2);
				groupsData = _groupsData.filter(Boolean);
				if (!groupsData.length) {
					return callback();
				}

				async.parallel([
					function (next) {
						var keys = [];
						groupNames.forEach(function (groupName) {
							keys.push('group:' + groupName,
								'group:' + groupName + ':members',
								'group:' + groupName + ':pending',
								'group:' + groupName + ':invited',
								'group:' + groupName + ':owners',
								'group:' + groupName + ':member:pids'
							);
						});

						db.deleteAll(keys, function (err) {
							console.log(3);
							next(err);
						});
					},
					function (next) {
						db.sortedSetRemove([
							'groups:createtime',
							'groups:visible:createtime',
							'groups:visible:memberCount',
						], groupNames, function (err) {
							console.log(4);
							next(err);
						});
					},
					function (next) {
						const keys = groupNames.map(groupName => groupName.toLowerCase() + ':' + groupName);
						db.sortedSetRemove('groups:visible:name', keys, function (err) {
							console.log(5);
							next(err);
						});
					},
					function (next) {
						const fields = groupNames.map(groupName => utils.slugify(groupName));
						db.deleteObjectFields('groupslug:groupname', fields, function (err) {
							console.log(6);
							next(err);
						});
					},
					function (next) {
						removeGroupsFromPrivilegeGroups(groupNames, function (err) {
							console.log(7);
							next(err);
						});
					},
				], function (err) {
					console.log(8);
					next(err);
				});
			},
			function (next) {
				console.log(9);
				Groups.resetCache();
				plugins.fireHook('action:groups.destroy', { groups: groupsData });
				next();
			},
		], callback);
	};

	function removeGroupsFromPrivilegeGroups(groupNames, callback) {
		batch.processSortedSet('groups:createtime', function (otherGroups, next) {
			const privilegeGroups = otherGroups.filter(group => Groups.isPrivilegeGroup(group));
			const keys = privilegeGroups.map(group => 'group:' + group + ':members');
			db.sortedSetRemove(keys, groupNames, next);
		}, {
			batch: 500,
		}, callback);
	}
};
