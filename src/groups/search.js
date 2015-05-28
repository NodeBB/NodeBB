'use strict';

var	async = require('async'),

	user = require('../user'),
	db = require('./../database');

module.exports = function(Groups) {

	Groups.search = function(query, options, callback) {
		if (!query) {
			return callback(null, []);
		}
		query = query.toLowerCase();
		async.waterfall([
			async.apply(db.getObjectValues, 'groupslug:groupname'),
			function(groupNames, next) {
				groupNames = groupNames.filter(function(name) {
					return name.toLowerCase().indexOf(query) !== -1 && name !== 'administrators';
				});
				groupNames = groupNames.slice(0, 100);
				Groups.getGroupsData(groupNames, next);
			},
			function(groupsData, next) {
				groupsData.forEach(Groups.escapeGroupData);
				next(null, groupsData);
			},
			async.apply(Groups.sort, options.sort)
		], callback);
	};

	Groups.sort = function(strategy, groups, next) {
		switch(strategy) {
			case 'count':
				groups = groups.sort(function(a, b) {
					return a.slug > b.slug;
				}).sort(function(a, b) {
					return a.memberCount < b.memberCount;
				});
				break;

			case 'date':
				groups = groups.sort(function(a, b) {
					return a.createtime < b.createtime;
				});
				break;

			case 'alpha':	// intentional fall-through
			default:
				groups = groups.sort(function(a, b) {
					return a.slug > b.slug ? 1 : -1;
				});
		}

		next(null, groups);
	};

	Groups.searchMembers = function(data, callback) {

		function findUids(query, searchBy, callback) {
			if (!query) {
				return Groups.getMembers(data.groupName, 0, -1, callback);
			}

			query = query.toLowerCase();

			async.waterfall([
				function(next) {
					Groups.getMembers(data.groupName, 0, -1, next);
				},
				function(members, next) {
					user.getMultipleUserFields(members, ['uid'].concat([searchBy]), next);
				},
				function(users, next) {
					var uids = [];
					for(var i=0; i<users.length; ++i) {
						var field = users[i][searchBy];
						if (field.toLowerCase().startsWith(query)) {
							uids.push(users[i].uid);
						}
					}
					next(null, uids);
				}
			], callback);
		}

		data.findUids = findUids;
		user.search(data, callback);
	};
};
