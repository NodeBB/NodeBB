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

		var groupObj;
		var groupsData;
		async.waterfall([
			function (next) {
				Groups.getGroupsData(groupNames, next);
			},
			function (_groupsData, next) {
				groupsData = _groupsData.filter(Boolean);
				if (!groupsData.length) {
					return callback();
				}
				// backwards compatibility
				groupObj = groupsData[0];

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

						db.deleteAll(keys, next);
					},
					function (next) {
						db.sortedSetRemove([
							'groups:createtime',
							'groups:visible:createtime',
							'groups:visible:memberCount',
						], groupNames, next);
					},
					function (next) {
						var keys = groupNames.map(function (groupName) {
							return groupName.toLowerCase() + ':' + groupName;
						});
						db.sortedSetRemove('groups:visible:name', keys, next);
					},
					function (next) {
						var fields = groupNames.map(function (groupName) {
							return utils.slugify(groupName);
						});
						db.deleteObjectFields('groupslug:groupname', fields, next);
					},
					function (next) {
						removeGroupsFromOtherGroups(groupNames, next);
					},
				], function (err) {
					next(err);
				});
			},
			function (next) {
				Groups.resetCache();
				plugins.fireHook('action:group.destroy', { group: groupObj });
				plugins.fireHook('action:groups.destroy', { groups: groupsData });
				next();
			},
		], callback);
	};

	function removeGroupsFromOtherGroups(groupNames, callback) {
		batch.processSortedSet('groups:createtime', function (otherGroups, next) {
			var keys = otherGroups.map(function (group) {
				return 'group:' + group + ':members';
			});
			db.sortedSetRemove(keys, groupNames, next);
		}, {
			batch: 500,
		}, callback);
	}
};
