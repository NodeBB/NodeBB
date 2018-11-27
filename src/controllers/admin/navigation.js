'use strict';

var async = require('async');

var navigationAdmin = require('../../navigation/admin');
const groups = require('../../groups');

var navigationController = module.exports;

navigationController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				admin: async.apply(navigationAdmin.getAdmin),
				groups: async.apply(groups.getNonPrivilegeGroups, 'groups:createtime', 0, -1),
			}, next);
		},
		function (result) {
			result.groups.sort((a, b) => b.system - a.system);
			result.groups = result.groups.map(group => ({ name: group.name, displayName: group.displayName }));

			result.admin.enabled.forEach(function (enabled, index) {
				enabled.index = index;
				enabled.selected = index === 0;

				enabled.groups = result.groups.map(function (group) {
					return {
						displayName: group.displayName,
						selected: enabled.groups.includes(group.name),
					};
				});
			});

			result.admin.available.forEach(function (available) {
				available.groups = result.groups;
			});

			result.admin.navigation = result.admin.enabled.slice();

			res.render('admin/general/navigation', result.admin);
		},
	], next);
};
