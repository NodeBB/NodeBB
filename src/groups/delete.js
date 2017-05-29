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
					async.apply(db.delete, 'group:' + groupName),
					async.apply(db.sortedSetRemove, 'groups:createtime', groupName),
					async.apply(db.sortedSetRemove, 'groups:visible:createtime', groupName),
					async.apply(db.sortedSetRemove, 'groups:visible:memberCount', groupName),
					async.apply(db.sortedSetRemove, 'groups:visible:name', groupName.toLowerCase() + ':' + groupName),
					async.apply(db.delete, 'group:' + groupName + ':members'),
					async.apply(db.delete, 'group:' + groupName + ':pending'),
					async.apply(db.delete, 'group:' + groupName + ':invited'),
					async.apply(db.delete, 'group:' + groupName + ':owners'),
					async.apply(db.delete, 'group:' + groupName + ':member:pids'),
					async.apply(db.deleteObjectField, 'groupslug:groupname', utils.slugify(groupName)),
					function (next) {
						batch.processSortedSet('groups:createtime', function (groupNames, next) {
							var keys = groupNames.map(function (group) {
								return 'group:' + group + ':members';
							});
							db.sortedSetsRemove(keys, groupName, next);
						}, {
							batch: 500,
						}, next);
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
};
