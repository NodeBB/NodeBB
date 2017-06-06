'use strict';

var async = require('async');
var plugins = require('../plugins');
var utils = require('../utils');
var db = require('./../database');
var batch = require('../batch');

module.exports = function (Groups) {
	Groups.destroy = function (groupName, callback) {
		var groupObj;
		async.waterfall([
			function (next) {
				Groups.getGroupsData([groupName], next);
			},
			function (groupsData, next) {
				if (!groupsData[0]) {
					return callback();
				}
				groupObj = groupsData[0];

				async.parallel([
					function (next) {
						db.deleteAll([
							'group:' + groupName,
							'group:' + groupName + ':members',
							'group:' + groupName + ':pending',
							'group:' + groupName + ':invited',
							'group:' + groupName + ':owners',
							'group:' + groupName + ':member:pids',
						], next);
					},
					function (next) {
						db.sortedSetsRemove([
							'groups:createtime',
							'groups:visible:createtime',
							'groups:visible:memberCount',
						], groupName, next);
					},
					function (next) {
						db.sortedSetRemove('groups:visible:name', groupName.toLowerCase() + ':' + groupName, next);
					},
					function (next) {
						db.deleteObjectField('groupslug:groupname', utils.slugify(groupName), next);
					},
					function (next) {
						removeGroupFromOtherGroups(groupName, next);
					},
				], function (err) {
					next(err);
				});
			},
			function (next) {
				Groups.resetCache();
				plugins.fireHook('action:group.destroy', { group: groupObj });
				next();
			},
		], callback);
	};

	function removeGroupFromOtherGroups(groupName, callback) {
		batch.processSortedSet('groups:createtime', function (groupNames, next) {
			var keys = groupNames.map(function (group) {
				return 'group:' + group + ':members';
			});
			db.sortedSetsRemove(keys, groupName, next);
		}, {
			batch: 500,
		}, callback);
	}
};
