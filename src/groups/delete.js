'use strict';

var async = require('async'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils'),
	db = require('./../database');

module.exports = function(Groups) {

	Groups.destroy = function(groupName, callback) {
		Groups.getGroupsData([groupName], function(err, groupsData) {
			if (err) {
				return callback(err);
			}
			if (!Array.isArray(groupsData) || !groupsData[0]) {
				return callback();
			}
			var groupObj = groupsData[0];
			plugins.fireHook('action:group.destroy', groupObj);

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
				async.apply(db.deleteObjectField, 'groupslug:groupname', utils.slugify(groupName)),
				function(next) {
					db.getSortedSetRange('groups:createtime', 0, -1, function(err, groups) {
						if (err) {
							return next(err);
						}
						async.each(groups, function(group, next) {
							db.sortedSetRemove('group:' + group + ':members', groupName, next);
						}, next);
					});
				}
			], callback);
		});
	};
};
